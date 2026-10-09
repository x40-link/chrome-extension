import {createShortLink, ApiError} from './api.js';
import {apiBase, destination, domain, HOSTED_API, HOSTED_DOMAIN, hostPermissionPattern, requestId, slug} from './validation.js';
import type {ClientMessage, Draft, PublicConfig, Result, ServerReply} from './messages.js';
import {copy} from './strings.js';

type Account = {apiBaseUrl:string; defaultDomain:string; token:string};
type NotificationAction = {type:'copy'; value:string} | {type:'form'; draft:Draft};
const development = chrome.runtime.getManifest().optional_host_permissions?.some((x:string) => x.startsWith('http://localhost/')) ?? false;
let saveQueue:Promise<unknown> = Promise.resolve();
let offscreenOpening:Promise<void>|undefined;

async function account():Promise<Account|undefined> { return (await chrome.storage.local.get('account')).account as Account|undefined; }
async function state():Promise<{config:PublicConfig; result?:Result; draft?:Draft}> {
  const a = await account();
  const transient = await chrome.storage.session.get(['result','draft']);
  return {config:{apiBaseUrl:a?.apiBaseUrl ?? HOSTED_API,defaultDomain:a?.defaultDomain ?? HOSTED_DOMAIN,configured:!!a,tokenConfigured:!!a?.token},result:transient.result,draft:transient.draft};
}
function fail(kind:string,message:string,retryable=false):ServerReply {return {ok:false,kind,message,retryable};}
async function saveSettings(msg:Extract<ClientMessage,{type:'SAVE_SETTINGS'}>):Promise<ServerReply> {
  const base = apiBase(msg.apiBaseUrl,development), host = domain(msg.defaultDomain);
  if (!base.ok) return fail('apiBaseUrl',base.error);
  if (!host.ok) return fail('defaultDomain',host.error);
  if (typeof msg.token !== 'string' || /[\r\n]/.test(msg.token)) return fail('token',copy.tokenNeeded);
  const old = await account();
  const switched = old?.apiBaseUrl !== base.value;
  if (base.value !== HOSTED_API && !(await chrome.permissions.contains({origins:[hostPermissionPattern(base.value)]}))) return fail('apiBaseUrl','Host access is required. Your previous settings and token are unchanged.');
  // Store the account as one value. A host switch cannot expose the old token to the new origin.
  const token = switched ? msg.token.trim() : (msg.token.trim() || old?.token || '');
  await chrome.storage.local.set({account:{apiBaseUrl:base.value,defaultDomain:host.value,token}});
  await chrome.storage.session.remove(['result','draft']);
  return {ok:true,config:(await state()).config};
}
async function copyUrl(value:string):Promise<boolean> {
  try {
    if (!offscreenOpening) offscreenOpening=(async()=>{
      const existing=await chrome.runtime.getContexts({contextTypes:[chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],documentUrls:[chrome.runtime.getURL('offscreen.html')]});
      if (!existing.length) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.CLIPBOARD],justification:'Copy the short link requested by the user.'});
    })();
    await offscreenOpening;
    offscreenOpening=undefined;
    const answer = await chrome.runtime.sendMessage({type:'OFFSCREEN_COPY',value});
    return answer?.ok === true;
  } catch {offscreenOpening=undefined;return false;}
}
async function notifySuccess(shortUrl:string,copied:boolean):Promise<void> {
  const id = crypto.randomUUID();
  const action:NotificationAction = {type:'copy',value:shortUrl};
  await chrome.storage.session.set({[`notification:${id}`]:action});
  try { await chrome.notifications.create(id,{type:'basic',iconUrl:'icons/icon128.png',title:copy.title,message:`${shortUrl}\n${copied ? copy.copied : 'Copy the short link'}`,buttons:copied ? [] : [{title:copy.copyAction}]}); } catch { /* badge and result remain available */ }
  await chrome.action.setBadgeText({text:copied ? '✓' : 'LINK'});
  await chrome.action.setBadgeBackgroundColor({color:'#286D77'});
  setTimeout(() => {void chrome.action.setBadgeText({text:''});},6000);
}
async function notifyFailure(message:string,draft:Draft):Promise<void> {
  const id = crypto.randomUUID();
  await chrome.storage.session.set({draft,[`notification:${id}`]:{type:'form',draft} satisfies NotificationAction});
  try { await chrome.notifications.create(id,{type:'basic',iconUrl:'icons/icon128.png',title:'Could not create short link',message:message.slice(0,250),buttons:[{title:copy.openForm}]}); } catch { /* draft is available from toolbar */ }
  await chrome.action.setBadgeText({text:'!'});
  await chrome.action.setBadgeBackgroundColor({color:'#A33B31'});
}
async function create(destinationUrl:string, domainName:string, path:string|undefined, id:string, notify=true):Promise<ServerReply> {
  const a = await account();
  if (!a?.token) return fail('token',copy.noSetup);
  const target=destination(destinationUrl), host=domain(domainName), parsedPath=path===undefined?undefined:slug(path);
  if (!target.ok) return fail('destination',target.error);
  if (!host.ok) return fail('domain',host.error);
  if (parsedPath && !parsedPath.ok) return fail('slug',parsedPath.error);
  if (!requestId(id)) return fail('requestId','Invalid request ID.');
  try {
    const link = await createShortLink({apiBaseUrl:a.apiBaseUrl,token:a.token,domain:host.value,destinationUrl:target.value,path:parsedPath?.ok?parsedPath.value:undefined,requestId:id,development});
    const copied = await copyUrl(link.shortUrl);
    const result = {shortUrl:link.shortUrl,copied};
    await chrome.storage.session.set({result});
    if (notify) await notifySuccess(link.shortUrl,copied);
    return {ok:true,result};
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('network',copy.network,true);
    return fail(err.kind,err.message,err.retryable);
  }
}
function validMessage(x:unknown):x is ClientMessage {
  if (!x || typeof x !== 'object') return false;
  const m=x as Record<string,unknown>;
  if (m.type==='GET_STATE'||m.type==='SIGN_OUT'||m.type==='CLEAR_DRAFT') return true;
  if (m.type==='SAVE_SETTINGS') return ['apiBaseUrl','defaultDomain','token'].every(k=>typeof m[k]==='string');
  if (m.type==='CREATE') return ['destinationUrl','domain','slug','requestId'].every(k=>typeof m[k]==='string');
  if (m.type==='COPY') return typeof m.value==='string';
  return false;
}
async function handle(m:ClientMessage):Promise<ServerReply> {
  switch(m.type) {
    case 'GET_STATE': return {ok:true,...await state()};
    case 'SAVE_SETTINGS': {
      const result=saveQueue.then(()=>saveSettings(m)); saveQueue=result.catch(()=>{}); return result;
    }
    case 'SIGN_OUT': await chrome.storage.local.remove('account'); await chrome.storage.session.remove(['result','draft']); await chrome.action.setBadgeText({text:''}); return {ok:true,config:(await state()).config};
    case 'CLEAR_DRAFT': await chrome.storage.session.remove('draft'); return {ok:true};
    case 'COPY': return {ok:true,copied:destination(m.value).ok && await copyUrl(m.value)};
    case 'CREATE': return create(m.destinationUrl,m.domain,m.slug===''?undefined:m.slug,m.requestId);
  }
}
chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse) => {
  if (sender.id !== chrome.runtime.id || !validMessage(message)) return false;
  void handle(message).then(sendResponse).catch(()=>sendResponse(fail('server','Extension error. Please retry.',true)));
  return true;
});
async function installMenus():Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({id:'page',title:'Shorten this page',contexts:['page']});
  chrome.contextMenus.create({id:'link',title:'Shorten this link',contexts:['link']});
}
chrome.runtime.onInstalled.addListener(() => {void installMenus(); void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});});
void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
export function handleContext(info:{menuItemId:string|number;linkUrl?:string;pageUrl?:string}):void {
  const selected = info.menuItemId==='link' ? info.linkUrl : info.menuItemId==='page' ? info.pageUrl : undefined;
  if (!selected) return;
  const checked=destination(selected);
  if (!checked.ok) { void notifyFailure(copy.invalidDestination,{destinationUrl:selected,domain:HOSTED_DOMAIN,slug:''}); return; }
  void (async()=>{
    const a=await account(); const draft={destinationUrl:selected,domain:a?.defaultDomain??HOSTED_DOMAIN,slug:'',requestId:crypto.randomUUID()};
    const reply=await create(selected,draft.domain,undefined,draft.requestId);
    if (!reply.ok) await notifyFailure(reply.message,draft);
  })();
}
chrome.contextMenus.onClicked.addListener(handleContext);
export function handleNotificationButton(id:string):void {void (async()=>{
  const key=`notification:${id}`; const action=(await chrome.storage.session.get(key))[key] as NotificationAction|undefined;
  if (!action) return;
  if (action.type==='copy') {if(await copyUrl(action.value)) await chrome.storage.session.set({result:{shortUrl:action.value,copied:true}});}
  else {await chrome.storage.session.set({draft:action.draft}); await chrome.tabs.create({url:chrome.runtime.getURL('popup.html?editor=1')});}
  await chrome.storage.session.remove(key);
})();}
chrome.notifications.onButtonClicked.addListener(handleNotificationButton);
chrome.notifications.onClosed.addListener((id) => {void chrome.storage.session.remove(`notification:${id}`);});
