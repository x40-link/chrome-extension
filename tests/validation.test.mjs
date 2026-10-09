import test from 'node:test';import assert from 'node:assert/strict';
import {apiBase,destination,domain,slug} from '../dist/validation.js';
test('validates instance and form values without rewriting destination',()=>{
  assert.equal(apiBase('https://api.x40.link/',false).value,'https://api.x40.link');
  for(const value of ['https://u:p@host.test','https://host.test/a','https://host.test/?','https://host.test/#a','http://host.test'])assert.equal(apiBase(value,false).ok,false,value);
  assert.equal(apiBase('http://127.0.0.1:8787',true).ok,true);assert.equal(apiBase('http://example.test',true).ok,false);
  for(const value of ['https://x40.link','x40.link:443','x40.link/a','x40.link?x=1'])assert.equal(domain(value).ok,false,value);
  assert.equal(domain('X40.TEST').value,'x40.test');
  const exact='https://example.org/a?utm=x#part';assert.equal(destination(exact).value,exact);
  for(const value of ['chrome://settings','file:///x','data:text/plain,x'])assert.equal(destination(value).ok,false);
  assert.equal(slug('').value,'');assert.equal(slug('a%2Fb+X').value,'/a%2Fb+X');assert.equal(slug('/').value,'/');
  assert.equal(slug('a?b').ok,false);
});
