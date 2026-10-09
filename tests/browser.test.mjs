import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createMockServer,TEST_TOKEN} from '../mock/server.mjs';

const extension=path.resolve('dist');
const launch=profile=>chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
async function popup(context,id){const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html`);return page;}
async function until(read,predicate){for(let i=0;i<100;i++){const value=await read();if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Timed out waiting for browser state');}

test('unpacked extension setup, form create, errors, restart, and instance switch',async()=>{
  let mock=createMockServer();const base=await mock.listen();const profile=await mkdtemp(path.join(os.tmpdir(),'x40-browser-'));
  let context;
  try{
    context=await launch(profile);const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
    let page=await popup(context,id);
    await page.locator('#setup-heading').waitFor();
    await page.getByLabel('API base URL').fill(base);
    await page.getByLabel('Default short domain').fill('x40.test');
    await page.getByLabel('Bearer token').fill(TEST_TOKEN);
    await page.getByRole('button',{name:'Save settings'}).click();
    await page.getByLabel('Destination URL').waitFor({timeout:5000});
    const contextPage='https://example.org/context-page?ref=sidebar#details';
    await page.evaluate(url=>chrome.runtime.sendMessage({type:'DEV_CONTEXT',menuItemId:'page',pageUrl:url}),contextPage);
    let contextResult=await until(()=>page.evaluate(async()=>(await chrome.storage.session.get('result')).result),Boolean);
    assert.equal(contextResult.copied,true,'offscreen clipboard should copy the returned URL');
    assert.equal((await fetch(contextResult.shortUrl,{redirect:'manual'})).headers.get('location'),contextPage);
    const contextLink='https://example.org/context-link?ref=mail#section';
    await page.evaluate(url=>chrome.runtime.sendMessage({type:'DEV_CONTEXT',menuItemId:'link',pageUrl:'https://wrong.example/',linkUrl:url}),contextLink);
    contextResult=await until(()=>page.evaluate(async()=>(await chrome.storage.session.get('result')).result),r=>r?.shortUrl!==contextResult.shortUrl);
    assert.equal((await fetch(contextResult.shortUrl,{redirect:'manual'})).headers.get('location'),contextLink);
    await page.getByLabel('Destination URL').fill('https://example.org/article?ref=mail#section');
    await page.getByRole('button',{name:'Create short link'}).click();
    await page.getByRole('heading',{name:'Short link ready'}).waitFor();
    const generated=await page.locator('#short-url').innerText();assert.match(generated,/^http:\/\/127\.0\.0\.1:/);
    const redirect=await fetch(generated,{redirect:'manual'});assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'https://example.org/article?ref=mail#section');
    await page.getByLabel('Slug optional').fill('chosen');await page.getByRole('button',{name:'Create short link'}).click();
    await page.getByRole('heading',{name:'Short link ready'}).waitFor();
    await page.getByRole('button',{name:'Create short link'}).click();await page.locator('#slug-error').getByText(/already taken/).waitFor();
    assert.equal(await page.getByLabel('Destination URL').inputValue(),'https://example.org/article?ref=mail#section');
    await page.getByLabel('Slug optional').fill('recover');await mock.close();
    await page.getByRole('button',{name:'Create short link'}).click();await page.locator('#form-error').getByText(/Could not reach/).waitFor();
    assert.equal(await page.getByLabel('Destination URL').inputValue(),'https://example.org/article?ref=mail#section');
    mock=createMockServer({port:Number(new URL(base).port)});await mock.listen();
    await page.getByRole('button',{name:'Create short link'}).click();await page.locator('#short-url').getByText(/recover/).waitFor();
    await page.getByRole('button',{name:'Settings'}).click();await page.getByLabel('Bearer token').fill('x40-test-expired');await page.getByRole('button',{name:'Save settings'}).click();
    await page.getByLabel('Destination URL').waitFor();await page.getByLabel('Slug optional').fill('expired');
    await page.getByRole('button',{name:'Create short link'}).click();await page.locator('#form-error').getByText(/invalid or expired/).waitFor();
    assert.equal(await page.getByLabel('Destination URL').inputValue(),'https://example.org/article?ref=mail#section');
    await page.evaluate(url=>chrome.runtime.sendMessage({type:'DEV_CONTEXT',menuItemId:'page',pageUrl:url}),contextPage);
    await until(()=>page.evaluate(async()=>chrome.storage.session.get(null)),values=>Object.values(values).some(x=>x?.type==='form'));
    const notificationId=await page.evaluate(async()=>Object.entries(await chrome.storage.session.get(null)).find(([k,v])=>k.startsWith('notification:')&&v?.type==='form')?.[0].slice('notification:'.length));
    assert.ok(notificationId);
    await page.evaluate(id=>chrome.runtime.sendMessage({type:'DEV_NOTIFICATION_BUTTON',id}),notificationId);
    const editor=context.pages().find(p=>p!==page&&p.url().includes('popup.html?editor=1'))??await context.waitForEvent('page');
    await editor.getByLabel('Destination URL').waitFor();assert.equal(await editor.getByLabel('Destination URL').inputValue(),contextPage);await editor.close();
    await page.getByRole('button',{name:'Settings'}).click();await page.getByLabel('Bearer token').fill(TEST_TOKEN);await page.getByRole('button',{name:'Save settings'}).click();await page.getByLabel('Destination URL').waitFor();
    await page.setViewportSize({width:280,height:500});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    await page.getByLabel('Destination URL').fill(`https://example.org/${'long-path-'.repeat(100)}?query=${'long'.repeat(100)}#section`);
    await page.evaluate(()=>{document.documentElement.style.fontSize='20px';});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
    await page.close();await context.close();
    context=await launch(profile);page=await popup(context,id);await page.getByLabel('Destination URL').waitFor();
    await page.getByRole('button',{name:'Settings'}).click();assert.equal(await page.locator('#stored-token').isVisible(),true);
    const denied=await page.evaluate(async()=>chrome.runtime.sendMessage({type:'SAVE_SETTINGS',apiBaseUrl:'https://selfhost.example',defaultDomain:'selfhost.example',token:''}));
    assert.equal(denied.ok,false);
    let account=await page.evaluate(async()=>((await chrome.storage.local.get('account')).account));
    assert.equal(account.apiBaseUrl,base);assert.equal(account.token,TEST_TOKEN);
    await page.getByLabel('API base URL').fill('https://api.x40.link');await page.getByRole('button',{name:'Save settings'}).click();
    await page.getByLabel('API base URL').waitFor();
    account=await page.evaluate(async()=>((await chrome.storage.local.get('account')).account));assert.equal(account.apiBaseUrl,'https://api.x40.link');assert.equal(account.token,'');
  }finally{if(context)await context.close();await mock.close();await rm(profile,{recursive:true,force:true});}
});
