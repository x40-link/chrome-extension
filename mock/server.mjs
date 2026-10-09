import http from 'node:http';
import {randomUUID} from 'node:crypto';

export const TEST_TOKEN = 'x40-test-create-only'; // Nonproduction fixture; never accepted by x40.
const domainPattern=/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
const status=(response,httpStatus,code,message)=>{response.writeHead(httpStatus,{'Content-Type':'application/json'});response.end(JSON.stringify({code,message,details:[]}));};
const urlOk=value=>{try{return typeof value==='string'&&['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
const pathOk=value=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[?#\u0000-\u001f\u007f]/.test(value);
function encodedPath(path){const alphabet='abcdefghijklmnopqrstuvwxyz234567';let bits=0,buffer=0,out='';for(const byte of Buffer.from(path)){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(buffer>>bits)&31];}}if(bits)out+=alphabet[(buffer<<(5-bits))&31];return `p${out}`;}

export function createMockServer({port=0}={}) {
  const links=new Map(),replays=new Map();let sequence=0;
  const server=http.createServer(async(request,response)=>{
    const address=new URL(request.url??'/',`http://${request.headers.host}`);
    if(request.method==='POST'&&address.pathname==='/__reset'){links.clear();replays.clear();sequence=0;response.writeHead(204);response.end();return;}
    if(request.method==='GET'&&address.pathname.startsWith('/r/')){
      const link=links.get(address.pathname);if(!link)return status(response,404,5,'Short link not found');
      response.writeHead(307,{Location:link.destinationUrl,'Cache-Control':'no-store'});response.end();return;
    }
    const match=/^\/v1alpha\/domains\/([^/]+)\/shortLinks$/.exec(address.pathname);
    if(request.method!=='POST'||!match)return status(response,404,5,'Unknown route');
    const domain=decodeURIComponent(match[1]).toLowerCase();
    if(!domainPattern.test(domain)||domain.includes('..')||domain.split('.').some(x=>!x||x.length>63))return status(response,400,3,'Invalid domain');
    const authorization=request.headers.authorization;
    if(authorization==='Bearer x40-test-expired')return status(response,401,16,'Token expired');
    if(authorization==='Bearer x40-test-no-create-scope')return status(response,403,7,'Missing CreateShortLink scope');
    if(authorization!==`Bearer ${TEST_TOKEN}`)return status(response,401,16,'Invalid token');
    if(domain==='denied.test')return status(response,403,7,'Permission denied for domain');
    const requestId=address.searchParams.get('requestId');
    if(!requestId||requestId.length>36||/[^\x21-\x7e]/.test(requestId))return status(response,400,3,'Invalid requestId');
    let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>100000)return status(response,413,3,'Body too large');}
    let body;try{body=JSON.parse(raw);}catch{return status(response,400,3,'Invalid JSON');}
    if(!body||Array.isArray(body)||!urlOk(body.destinationUrl))return status(response,400,3,'Invalid destinationUrl');
    if(Object.hasOwn(body,'path')&&!pathOk(body.path))return status(response,400,3,'Invalid path');
    const replayKey=`${authorization}:${requestId}`,fingerprint=JSON.stringify({domain,destinationUrl:body.destinationUrl,path:body.path});
    const replay=replays.get(replayKey);
    if(replay){if(replay.fingerprint!==fingerprint)return status(response,400,3,'requestId reused for different request');response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(replay.link));return;}
    const path=Object.hasOwn(body,'path')?body.path:`/g${String(++sequence).padStart(6,'0')}`;
    const key=`/r/${encodeURIComponent(domain)}${path}`;
    if(links.has(key))return status(response,409,6,'Custom path already exists');
    const now='2026-10-09T00:00:00Z';
    const link={name:`domains/${domain}/shortLinks/${encodedPath(path)}`,path,destinationUrl:body.destinationUrl,shortUrl:`http://127.0.0.1:${server.address().port}${key}`,uid:`mock-${String(sequence).padStart(6,'0')}`,createTime:now,updateTime:now,etag:'"mock-1"'};
    links.set(key,link);replays.set(replayKey,{fingerprint,link});
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(link));
  });
  return {server,reset:()=>{links.clear();replays.clear();sequence=0;},listen:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`))),close:()=>new Promise(resolve=>server.close(resolve))};
}
if(import.meta.url===`file://${process.argv[1]}`){const mock=createMockServer({port:Number(process.env.PORT??8787)});mock.listen().then(base=>process.stdout.write(`x40 NONPRODUCTION mock at ${base}; token: ${TEST_TOKEN}\n`));}
