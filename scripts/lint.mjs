import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const source=fs.readdirSync('src').filter(x=>x.endsWith('.ts')).map(x=>fs.readFileSync(`src/${x}`,'utf8')).join('\n');
for(const forbidden of [/\beval\s*\(/,/\bnew\s+Function\s*\(/,/storage\.sync/,/innerHTML\s*=/])if(forbidden.test(source))throw new Error(`Forbidden source pattern: ${forbidden}`);
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json','--noEmit'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
for(const file of ['mock/server.mjs','scripts/package.mjs','scripts/release.mjs','scripts/capture-store.mjs']){if(!fs.existsSync(file))continue;const checked=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(checked.status!==0)process.exit(checked.status??1);}
