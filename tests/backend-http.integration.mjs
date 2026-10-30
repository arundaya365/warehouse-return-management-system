import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const port=3128, base='http://127.0.0.1:'+port;
const token=randomBytes(24).toString('hex');
const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',LOCAL_TRIAL:'true',SQL_DRIVER:'pglite',PGLITE_DATA_DIR:mkdtempSync(resolve('../qa-http-')),LOCAL_STOP_TOKEN:token},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
const post=(path,data)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
try{
 let ready=false;
 for(let attempt=0;attempt<80;attempt++){
  if(child.exitCode!==null)throw Error(logs);
  try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(800)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Isolated server did not start: '+logs);
 const before=await (await fetch(base+'/api/sync')).json();
 assert.equal((await post('/api/sync/returns',{rows:[null],orderId:'QA'})).status,400);
 assert.equal((await post('/api/sync/disputes',{disputes:[]})).status,400);
 assert.equal((await post('/api/sync/disputes',{disputes:{_rma_claims_list_:[null]}})).status,409);
 const invalid=await fetch(base+'/api/sync/returns',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
 assert.equal(invalid.status,400);assert.match(invalid.headers.get('content-type'),/json/);
 const missing=await fetch(base+'/api/missing');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/json/);
 const after=await (await fetch(base+'/api/sync')).json();assert.equal(after.returns.length,before.returns.length);
 console.log('PASS: isolated HTTP startup, invalid return payload, invalid claim payload, JSON parse errors and API 404. Invalid requests leave database unchanged.');
}finally{
 try{await fetch(base+'/api/local/stop',{method:'POST',headers:{'x-local-stop-token':token},signal:AbortSignal.timeout(1500)});}catch{}
 await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(()=>{if(child.exitCode===null)child.kill();resolve();},3000);});
}
