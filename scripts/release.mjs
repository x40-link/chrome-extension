import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('dist/manifest.json'));
if(manifest.host_permissions.some(x=>x.startsWith('http://'))||manifest.optional_host_permissions.some(x=>x.startsWith('http://')))throw new Error('Build a production manifest before making the review package.');
const files=[];function visit(directory,prefix){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,item.name);if(item.isDirectory())visit(full,prefix+'/'+item.name);else files.push([full,prefix+'/'+item.name]);}}
visit('dist','extension');
visit('assets/store','store-assets');
files.push(['assets/icon.svg','store-assets/icon.svg']);
for(const name of ['README.md','SPEC.md','STORE_LISTING.md','RELEASE_CHECKLIST.md','contract/PIN.md'])files.push([name,name]);
files.sort((a,b)=>a[1].localeCompare(b[1]));fs.mkdirSync('release',{recursive:true});
const manifestFile=path.join(os.tmpdir(),`x40-review-${process.pid}.json`);fs.writeFileSync(manifestFile,JSON.stringify(files));
const script=`import json,sys,zipfile\nfiles=json.load(open(sys.argv[1]))\nwith zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for source,name in files:\n  info=zipfile.ZipInfo(name,date_time=(2026,10,9,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16\n  z.writestr(info,open(source,'rb').read())\n`;
const output='release/x40-review-only.zip';const result=spawnSync('python3',['-c',script,manifestFile,output],{stdio:'inherit'});fs.unlinkSync(manifestFile);if(result.status!==0)process.exit(result.status??1);console.log(`${output} — review only; public Store gates remain open`);
