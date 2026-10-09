import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createShortLink,ApiError} from '../dist/api.js';
import {createMockServer,TEST_TOKEN} from '../mock/server.mjs';

const hashes={
  'short_link.openapi.json':'d6d17e21b570b0c24aae6c3a975abad4d39f06d3d16126f77a8d6354d22e7897',
  'http.md':'a5c951a6664fb07e5541420df3537cb16c52a30439fa58818147a422b9cc530b',
  'short_link.proto':'e98b957216a7f759707cba6cd5a28bd6f0b07d55c51d77412ce2c4fa9a937918'
};
test('pinned contract matches route, body and scope',()=>{
  for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(`contract/${file}`)).digest('hex'),hash);
  const spec=JSON.parse(fs.readFileSync('contract/short_link.openapi.json'));
  assert.equal(spec.openapi,'3.1.0');assert.equal(spec.servers,undefined);
  const create=spec.paths['/v1alpha/domains/{parent}/shortLinks'].post;
  assert.equal(create.operationId,'ShortLinkService_CreateShortLink');
  assert.equal(create.requestBody.content['application/json'].schema.$ref,'#/components/schemas/x40.link.v1alpha.ShortLink');
  assert.equal(create.responses['200'].content['application/json'].schema.$ref,'#/components/schemas/x40.link.v1alpha.ShortLink');
  assert.ok(create.parameters.some(p=>p.name==='requestId'&&p.in==='query'));
  const http=fs.readFileSync('contract/http.md','utf8'),proto=fs.readFileSync('contract/short_link.proto','utf8');
  assert.match(http,/without a `shortLink` wrapper/);assert.match(proto,/post: "\/v1alpha\/\{parent=domains\/\*\}\/shortLinks"/);
  assert.match(proto,/api\.x40\.link\/scopes\/x40\.link\.v1alpha\.ShortLinkService\.CreateShortLink/);
});

test('adapter sends exact route, bearer and unwrapped body; mock replays and redirects',async()=>{
  const mock=createMockServer();const base=await mock.listen();
  try{
    const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return fetch(url,options);};
    const target='https://example.org/article?ref=mail#section';
    const input={apiBaseUrl:base,token:TEST_TOKEN,domain:'x40.test',destinationUrl:target,requestId:'abc-123',development:true};
    const first=await createShortLink(input,{fetcher});const replay=await createShortLink(input,{fetcher});
    assert.deepEqual(replay,first);assert.equal(first.path,'/g000001');
    assert.equal(calls[0].url,`${base}/v1alpha/domains/x40.test/shortLinks?requestId=abc-123`);
    assert.equal(calls[0].options.headers.Authorization,`Bearer ${TEST_TOKEN}`);
    assert.deepEqual(JSON.parse(calls[0].options.body),{destinationUrl:target});
    const redirect=await fetch(first.shortUrl,{redirect:'manual'});assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),target);
    const explicit=await createShortLink({...input,path:'/chosen+slug',requestId:'abc-124'},{fetcher});
    assert.deepEqual(JSON.parse(calls[2].options.body),{destinationUrl:target,path:'/chosen+slug'});assert.equal(explicit.path,'/chosen+slug');
    await assert.rejects(createShortLink({...input,path:'/chosen+slug',requestId:'abc-125'}),e=>e instanceof ApiError&&e.kind==='conflict'&&!e.retryable);
    const root=await createShortLink({...input,path:'/',requestId:'abc-126'});assert.equal(root.path,'/');assert.match(root.name,/\/pf4$/);
  }finally{await mock.close();}
});

test('known authorization errors, network loss and malformed success are typed',async()=>{
  const mock=createMockServer();const base=await mock.listen();
  const input={apiBaseUrl:base,token:TEST_TOKEN,domain:'x40.test',destinationUrl:'https://example.org/',requestId:'errors-1',development:true};
  try{
    await assert.rejects(createShortLink({...input,token:'x40-test-expired'}),e=>e.kind==='token'&&!e.retryable);
    await assert.rejects(createShortLink({...input,token:'x40-test-no-create-scope'}),e=>e.kind==='token'&&!e.retryable);
    await assert.rejects(createShortLink({...input,domain:'denied.test'}),e=>e.kind==='token'&&!e.retryable);
    await assert.rejects(createShortLink(input,{fetcher:async()=>new Response('broken',{status:502})}),e=>e.kind==='server'&&e.retryable);
    await assert.rejects(createShortLink(input,{fetcher:async()=>new Response('{"shortUrl":"javascript:alert(1)"}',{status:200})}),e=>e.kind==='protocol'&&e.retryable);
    await assert.rejects(createShortLink(input,{fetcher:async()=>{throw new TypeError('offline');}}),e=>e.kind==='network'&&e.retryable);
  }finally{await mock.close();}
});
