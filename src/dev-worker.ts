import {handleContext,handleNotificationButton} from './worker.js';

// This test bridge is packaged only in the unpacked development build.
chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id||!message||typeof message!=='object')return false;
  const m=message as Record<string,unknown>;
  if(m.type==='DEV_CONTEXT'&&['page','link'].includes(String(m.menuItemId))&&typeof m.pageUrl==='string'&&(!m.linkUrl||typeof m.linkUrl==='string')){
    handleContext({menuItemId:String(m.menuItemId),pageUrl:m.pageUrl,linkUrl:typeof m.linkUrl==='string'?m.linkUrl:undefined});sendResponse({ok:true});return false;
  }
  if(m.type==='DEV_NOTIFICATION_BUTTON'&&typeof m.id==='string'){
    handleNotificationButton(m.id);sendResponse({ok:true});return false;
  }
  return false;
});
