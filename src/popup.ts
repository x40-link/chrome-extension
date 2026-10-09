import {apiBase, destination, domain, HOSTED_API, hostPermissionPattern, slug} from './validation.js';
import type {ClientMessage, Draft, PublicConfig, Result, ServerReply} from './messages.js';
import {copy} from './strings.js';

const $ = <T extends HTMLElement>(id:string):T => document.getElementById(id) as T;
const settings=$<HTMLFormElement>('settings-form'), form=$<HTMLFormElement>('create-form'), setup=$('setup');
const inputs={api:$<HTMLInputElement>('api-base'),defaultDomain:$<HTMLInputElement>('default-domain'),token:$<HTMLInputElement>('token'),destination:$<HTMLInputElement>('destination'),domain:$<HTMLInputElement>('domain'),slug:$<HTMLInputElement>('slug')};
let config:PublicConfig|undefined; let active=false; let pendingId:string|undefined; let pendingFingerprint=''; let result:Result|undefined;
async function send(m:ClientMessage):Promise<ServerReply> {return chrome.runtime.sendMessage(m) as Promise<ServerReply>;}
function error(id:string,message=''):void {$(`${id}-error`).textContent=message; const input=document.getElementById(id); if(input) input.setAttribute('aria-invalid',message?'true':'false');}
function clearErrors():void {for(const id of ['api-base','default-domain','token','destination','domain','slug']) error(id); $('form-error').hidden=true;}
function showSettings(open:boolean):void {settings.hidden=!open;form.hidden=open||!config?.tokenConfigured;setup.hidden=!!config?.tokenConfigured; $('heading').textContent=open?copy.setupTitle:copy.createTitle;$('settings-toggle').setAttribute('aria-label',open?'Back to form':'Settings');}
function renderResult(r:Result|undefined):void {result=r;const section=$('result');section.hidden=!r;if(!r)return;const link=$<HTMLAnchorElement>('short-url');link.textContent=r.shortUrl;link.href=r.shortUrl;$('copy-status').textContent=r.copied?'Copied to clipboard':'Automatic copy was unavailable. Use Copy.';}
function applyState(c:PublicConfig,draft?:Draft,r?:Result):void {config=c;inputs.api.value=c.apiBaseUrl;inputs.defaultDomain.value=c.defaultDomain;inputs.domain.value=draft?.domain??c.defaultDomain;inputs.destination.value=draft?.destinationUrl??inputs.destination.value;inputs.slug.value=draft?.slug??'';pendingId=draft?.requestId;pendingFingerprint=draft?fingerprint():'';$('stored-token').hidden=!c.tokenConfigured;renderResult(r);showSettings(!c.tokenConfigured);}
function busy(value:boolean):void {active=value;$<HTMLButtonElement>('create').disabled=value;$<HTMLButtonElement>('save').disabled=value;$<HTMLButtonElement>('create').textContent=value?'Creating…':'Create short link';}
function fingerprint():string {return JSON.stringify([inputs.destination.value,inputs.domain.value,inputs.slug.value]);}
for(const key of ['destination','domain','slug'] as const) inputs[key].addEventListener('input',()=>{pendingId=undefined;error(key);$('form-error').hidden=true;});
$('settings-toggle').addEventListener('click',()=>showSettings(settings.hidden));
settings.addEventListener('submit',async event=>{
  event.preventDefault();if(active)return;clearErrors();
  const dev=chrome.runtime.getManifest().optional_host_permissions?.some((x:string)=>x.startsWith('http://localhost/'))??false;
  const base=apiBase(inputs.api.value,dev),host=domain(inputs.defaultDomain.value);
  if(!base.ok)error('api-base',base.error);if(!host.ok)error('default-domain',host.error);
  if(!base.ok||!host.ok)return;
  if(base.value!==HOSTED_API){
    try{const granted=await chrome.permissions.request({origins:[hostPermissionPattern(base.value)]});if(!granted){error('api-base','Host access was denied. Previous settings are unchanged.');return;}}
    catch{error('api-base','Host access could not be requested. Previous settings are unchanged.');return;}
  }
  busy(true);const reply=await send({type:'SAVE_SETTINGS',apiBaseUrl:base.value,defaultDomain:host.value,token:inputs.token.value});busy(false);
  if(!reply.ok){error(reply.kind==='apiBaseUrl'?'api-base':reply.kind==='defaultDomain'?'default-domain':'token',reply.message);return;}
  inputs.token.value='';if(reply.config){applyState(reply.config);if(reply.config.tokenConfigured)showSettings(false);else error('token',copy.tokenNeeded);} $('status').textContent='Settings saved.';
});
$('signout').addEventListener('click',async()=>{if(active)return;const reply=await send({type:'SIGN_OUT'});if(reply.ok&&reply.config){inputs.destination.value='';inputs.slug.value='';inputs.token.value='';pendingId=undefined;applyState(reply.config);$('status').textContent='Signed out and result cleared.';}});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(active)return;clearErrors();
  const target=destination(inputs.destination.value),host=domain(inputs.domain.value),path=slug(inputs.slug.value);
  if(!target.ok)error('destination',target.error);if(!host.ok)error('domain',host.error);if(!path.ok)error('slug',path.error);
  if(!target.ok||!host.ok||!path.ok)return;
  const current=fingerprint();if(!pendingId||pendingFingerprint!==current){pendingId=crypto.randomUUID();pendingFingerprint=current;}
  busy(true);const reply=await send({type:'CREATE',destinationUrl:target.value,domain:host.value,slug:inputs.slug.value,requestId:pendingId});busy(false);
  if(reply.ok){renderResult(reply.result);pendingId=undefined;await send({type:'CLEAR_DRAFT'});$('status').textContent='Short link created.';return;}
  const id=reply.kind==='destination'?'destination':reply.kind==='domain'?'domain':reply.kind==='slug'||reply.kind==='conflict'?'slug':undefined;
  if(id)error(id,reply.message);else {$('form-error').textContent=reply.message;$('form-error').hidden=false;}
  if(!reply.retryable)pendingId=undefined;
});
$('copy').addEventListener('click',async()=>{if(!result)return;const reply=await send({type:'COPY',value:result.shortUrl});$('copy-status').textContent=reply.ok&&reply.copied?'Copied to clipboard':'Copy failed. Try selecting the link.';});
$('open').addEventListener('click',()=>{if(result)void chrome.tabs.create({url:result.shortUrl});});
void (async()=>{const reply=await send({type:'GET_STATE'});if(!reply.ok||!reply.config)return;applyState(reply.config,reply.draft,reply.result);if(!reply.draft){try{const tabs=await chrome.tabs.query({active:true,currentWindow:true});const url=tabs[0]?.url;if(url&&destination(url).ok)inputs.destination.value=url;}catch{}}if(new URLSearchParams(location.search).has('editor'))showSettings(false);})();
