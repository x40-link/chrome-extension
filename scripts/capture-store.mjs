import {chromium} from 'playwright';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {createMockServer,TEST_TOKEN} from '../mock/server.mjs';

const extension=path.resolve('dist');const profile=await mkdtemp(path.join(os.tmpdir(),'x40-capture-'));const mock=createMockServer();const base=await mock.listen();
let context;
try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
  const page=await context.newPage();await page.setViewportSize({width:1280,height:800});await page.goto(`chrome-extension://${id}/popup.html`);
  await page.addStyleTag({content:'html,body{width:1280px;max-width:none;min-height:800px} body{display:flex;justify-content:center;align-items:flex-start;padding-top:65px}.shell{width:360px;max-height:none;min-height:550px;box-shadow:0 14px 40px #0002;border-radius:20px;background:var(--background)}'});
  await mkdir('assets/store',{recursive:true});
  await page.screenshot({path:'assets/store/setup-development.png'});
  await page.getByLabel('API base URL').fill(base);await page.getByLabel('Default short domain').fill('x40.test');await page.getByLabel('Bearer token').fill(TEST_TOKEN);
  await page.getByRole('button',{name:'Save settings'}).click();await page.getByLabel('Destination URL').waitFor();
  await page.getByLabel('Destination URL').fill('https://example.org/article?ref=mail#section');await page.getByLabel('Slug optional').fill('weekly-notes');
  await page.screenshot({path:'assets/store/editor-development.png'});
}finally{if(context)await context.close();await mock.close();await rm(profile,{recursive:true,force:true});}
