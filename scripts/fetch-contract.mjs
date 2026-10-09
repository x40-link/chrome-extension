import fs from 'node:fs';
import {createHash} from 'node:crypto';

const commit='e54521f91a0d9199e9b3c1d7a5bb644ca11629e0';
const root=`https://raw.githubusercontent.com/x40-link/api/${commit}`;
const files=[
  ['docs/openapi/x40/link/v1alpha/short_link.openapi.json','contract/short_link.openapi.json','d6d17e21b570b0c24aae6c3a975abad4d39f06d3d16126f77a8d6354d22e7897'],
  ['docs/reference/http.md','contract/http.md','a5c951a6664fb07e5541420df3537cb16c52a30439fa58818147a422b9cc530b'],
  ['x40/link/v1alpha/short_link.proto','contract/short_link.proto','e98b957216a7f759707cba6cd5a28bd6f0b07d55c51d77412ce2c4fa9a937918']
];
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const [source,destination,expected] of files){
  if(!process.argv.includes('--force')&&fs.existsSync(destination)&&hash(fs.readFileSync(destination))===expected)continue;
  const response=await fetch(`${root}/${source}`);
  if(!response.ok)throw new Error(`Could not retrieve pinned contract ${source}: HTTP ${response.status}`);
  const contents=Buffer.from(await response.arrayBuffer());
  if(hash(contents)!==expected)throw new Error(`Pinned contract hash mismatch for ${source}`);
  fs.mkdirSync('contract',{recursive:true});
  fs.writeFileSync(`${destination}.tmp`,contents);
  fs.renameSync(`${destination}.tmp`,destination);
  console.log(`Verified ${destination}`);
}
