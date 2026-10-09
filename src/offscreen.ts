chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
  const m=message as Record<string,unknown>;
  if (m.type!=='OFFSCREEN_COPY' || typeof m.value!=='string') return false;
  const field=document.createElement('textarea');
  field.value=m.value;field.style.position='fixed';field.style.opacity='0';document.body.append(field);
  field.select();
  let ok=false;
  try{ok=document.execCommand('copy');}catch{ok=false;}finally{field.remove();}
  sendResponse({ok});
  return false;
});
