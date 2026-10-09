import test from 'node:test';import assert from 'node:assert/strict';
import {createMockServer,TEST_TOKEN} from '../mock/server.mjs';

test('service worker context menus, clipboard fallback, notification action, and host switch',async()=>{
  const mock=createMockServer();const base=await mock.listen();
  const handlers={},local=new Map(),session=new Map(),notifications=[],tabs=[],grants=new Set(['http://127.0.0.1/*']);
  let clipboard=true;
  const event=name=>({addListener:fn=>{handlers[name]=fn;}});
  const area=map=>({get:async keys=>{const out={};for(const key of Array.isArray(keys)?keys:[keys])if(map.has(key))out[key]=map.get(key);return out;},set:async values=>{for(const [k,v] of Object.entries(values))map.set(k,v);},remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])map.delete(key);},setAccessLevel:async()=>{}});
  globalThis.chrome={runtime:{id:'test-extension',ContextType:{OFFSCREEN_DOCUMENT:'OFFSCREEN_DOCUMENT'},getManifest:()=>({optional_host_permissions:['http://localhost/*']}),onMessage:event('message'),onInstalled:event('installed'),getURL:path=>`chrome-extension://test-extension/${path}`,getContexts:async()=>[{contextType:'OFFSCREEN_DOCUMENT'}],sendMessage:async msg=>msg.type==='OFFSCREEN_COPY'?{ok:clipboard}:{ok:false}},storage:{local:area(local),session:area(session)},permissions:{contains:async({origins})=>origins.every(x=>grants.has(x))},contextMenus:{onClicked:event('context'),removeAll:async()=>{},create:()=>{}},notifications:{onButtonClicked:event('notificationButton'),onClosed:event('notificationClosed'),create:async(id,options)=>{notifications.push({id,options});return id;}},offscreen:{Reason:{CLIPBOARD:'CLIPBOARD'},createDocument:async()=>{}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},tabs:{create:async value=>{tabs.push(value);}}};
  const send=message=>new Promise(resolve=>handlers.message(message,{id:'test-extension'},resolve));
  const waitFor=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for worker action');};
  try{
    await import(`../dist/worker.js?test=${Date.now()}`);
    const saved=await send({type:'SAVE_SETTINGS',apiBaseUrl:base,defaultDomain:'x40.test',token:TEST_TOKEN});assert.equal(saved.ok,true);
    const link='https://example.org/a?utm=mail#section';
    handlers.context({menuItemId:'link',linkUrl:link,pageUrl:'https://wrong.example/'});
    await waitFor(()=>notifications.length===1);assert.match(notifications[0].options.message,/Copied/);
    const first=session.get('result');assert.equal(first.copied,true);assert.equal((await fetch(first.shortUrl,{redirect:'manual'})).headers.get('location'),link);
    clipboard=false;handlers.context({menuItemId:'page',pageUrl:'https://example.org/page?x=1#part'});
    await waitFor(()=>notifications.length===2);assert.equal(notifications[1].options.buttons[0].title,'Copy');
    clipboard=true;handlers.notificationButton(notifications[1].id,0);await waitFor(()=>session.get('result')?.copied===true);
    local.set('account',{apiBaseUrl:base,defaultDomain:'x40.test',token:'x40-test-expired'});
    handlers.context({menuItemId:'page',pageUrl:link});await waitFor(()=>notifications.length===3);
    assert.equal(notifications[2].options.title,'Could not create short link');assert.equal(notifications[2].options.buttons[0].title,'Open form');
    handlers.notificationButton(notifications[2].id,0);await waitFor(()=>tabs.length===1);assert.match(tabs[0].url,/popup\.html\?editor=1$/);assert.equal(session.get('draft').destinationUrl,link);
    const denied=await send({type:'SAVE_SETTINGS',apiBaseUrl:'https://new.example',defaultDomain:'new.example',token:''});assert.equal(denied.ok,false);assert.equal(local.get('account').apiBaseUrl,base);
    grants.add('https://new.example/*');const switched=await send({type:'SAVE_SETTINGS',apiBaseUrl:'https://new.example',defaultDomain:'new.example',token:''});assert.equal(switched.ok,true);assert.equal(local.get('account').token,'');
    await send({type:'SIGN_OUT'});assert.equal(local.has('account'),false);assert.equal(session.has('result'),false);
  }finally{await mock.close();}
});
