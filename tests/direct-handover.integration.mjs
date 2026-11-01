import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const base='http://127.0.0.1:3132', token=randomBytes(24).toString('hex');
const database=mkdtempSync(resolve('../qa-direct-handover-'));
let child; let startupLogs='';
async function start(){
 child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'3132',HOST:'127.0.0.1',NODE_ENV:'production',LOCAL_TRIAL:'true',SQL_DRIVER:'pglite',PGLITE_DATA_DIR:database,WAREHOUSE_DATA_DIR:resolve(database,'json-cache'),LOCAL_STOP_TOKEN:token},stdio:['ignore','pipe','pipe']});
 startupLogs='';child.stdout.on('data',data=>startupLogs+=data);child.stderr.on('data',data=>startupLogs+=data);
 for(let attempt=0;attempt<200;attempt++){
  assert.equal(child.exitCode,null,'Isolated server exited during startup');
  try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)})).ok)return;}catch(error){if(attempt===199)startupLogs+='\nProbe: '+error.message+' '+error.cause?.code;}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Isolated server startup timeout: '+startupLogs.slice(-2500));
}
async function stop(){
 if(!child||child.exitCode!==null)return;
 const exited=new Promise(resolve=>child.once('exit',resolve));
 await fetch(base+'/api/local/stop',{method:'POST',headers:{'x-local-stop-token':token}}).catch(()=>{});
 await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);
 if(child.exitCode===null){child.kill();await exited;}
}
const read=async()=>await (await fetch(base+'/api/sync')).json();
const save=(disputes,expectedDisputes)=>fetch(base+'/api/sync/disputes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({disputes,expectedDisputes})});
try{
 await start();let current=await read();const initial=current.disputes;
 const key='QA_DIRECT__SKU_QA__0';
 const row={Order_ID:'QA_DIRECT',SKU_ID:'SKU_QA',Kondisi:'Damage Product',Nama_Barang:'Produk QA',Operator_ID:'QA',Waktu_Proses:'2026-10-31 10:00:00'};
 const source={row,claimStatus:'PENDING',claimAmount:0,approvedAmount:0,settlementAmount:0,isForwardedToRma:true};
 const handover={id:'qa_direct1',orderId:'QA_DIRECT',channel:'JNE',logisticsName:'JNE',stageStatus:'DIALIHKAN_KE_RMA',handoverReason:'',handoverEvidence:'',items:[{sourceKey:key,skuId:'SKU_QA',namaBarang:'Produk QA',qty:1,kondisi:'Damage Product',hargaSatuan:0,subtotalEstimasi:0,sourceClaimAmount:0,marketplaceReservedAmount:0,valuationPending:true}],estimatedCompensation:0,csNotes:'',forwardedBy:'CS QA',forwardedAt:'2026-10-31T01:00:00Z',updatedAt:'2026-10-31T01:00:00Z',history:[]};
 let payload={...initial,[key]:source,_rma_claims_list_:[...(initial._rma_claims_list_||[]),handover]};
 assert.equal((await save(payload,initial)).status,200,'Draft can hand over directly without marketplace rejection');
 assert.equal((await save(initial,initial)).status,409,'Stale snapshot cannot erase new RMA case');
 current=await read();
 assert.equal((await save({...current.disputes,_rma_claims_list_:[]},current.disputes)).status,409,'Normal sync cannot delete claim history');
 const omitted={...current.disputes};delete omitted._rma_claims_list_;
 assert.equal((await save(omitted,current.disputes)).status,409,'Omitting list cannot bypass ownership locks');
 assert.equal((await save({...current.disputes,[key]:{...source,claimStatus:'REJECTED'}},current.disputes)).status,409,'Transferred decision cannot be changed');
 async function update(changes){
  const previous=(await read()).disputes;
  const old=previous._rma_claims_list_.find(claim=>claim.id==='qa_direct1');
  const next={...old,...changes,updatedAt:new Date().toISOString(),history:[...old.history,{at:new Date().toISOString(),by:'RMA QA',from:old.stageStatus,to:changes.stageStatus,note:'QA transition'}]};
  const nextPayload={...previous,_rma_claims_list_:previous._rma_claims_list_.map(claim=>claim.id===old.id?next:claim)};
  assert.equal((await save(nextPayload,previous)).status,200,'Valid transition '+changes.stageStatus);
 }
 await update({stageStatus:'DITERIMA_RMA',rmaInvestigator:'RMA QA'});
 await update({stageStatus:'DITERIMA_RMA',estimatedCompensation:150000,items:handover.items.map(item=>({...item,subtotalEstimasi:150000}))});
 await update({stageStatus:'DIKEMBALIKAN_CS',returnReason:'Perlu ditangani marketplace',returnedAt:new Date().toISOString(),returnedBy:'RMA QA'});
 current=await read();
 assert.equal(current.disputes._rma_claims_list_.find(claim=>claim.id==='qa_direct1').returnReason,'Perlu ditangani marketplace');
 // Exact user example: two SKU claims10000 each, one total result10000.
 current=await read();
 const sourceA={row:{...row,Order_ID:'QA_SIMPLE',SKU_ID:'SKU_A'},claimStatus:'PENDING',claimAmount:10000,approvedAmount:0,settlementAmount:0};
 const sourceB={...sourceA,row:{...sourceA.row,SKU_ID:'SKU_B'}};
 const simpleItems=['A','B'].map((sku,index)=>({sourceKey:'QA_SIMPLE__SKU_'+sku+'__'+index,sourceClaimAmount:10000,marketplaceReservedAmount:0,valuationPending:false,skuId:'SKU_'+sku,namaBarang:'Produk '+sku,qty:1,kondisi:'Damage Product',hargaSatuan:10000,subtotalEstimasi:10000}));
 const simpleClaim={...handover,id:'qa_simple2',orderId:'QA_SIMPLE',items:simpleItems,estimatedCompensation:20000};
 const example={...current.disputes,QA_SIMPLE__SKU_A__0:sourceA,QA_SIMPLE__SKU_B__1:sourceB,_rma_claims_list_:[...current.disputes._rma_claims_list_,simpleClaim]};
 assert.equal((await save(example,current.disputes)).status,200);
 current=await read();
 const decided={...simpleClaim,workflowVersion:'SIMPLE',claimStatus:'PARTIAL',stageStatus:'HASIL_LOGISTIK',rmaInvestigator:'RMA QA',approvedAmount:10000,approvedCompensation:0,logisticsOutcome:'PARTIAL',history:[{at:new Date().toISOString(),by:'RMA QA',from:'DIALIHKAN_KE_RMA',to:'HASIL_LOGISTIK',note:'Total hasil10000 dari klaim20000'}]};
 const result={...current.disputes,_rma_claims_list_:current.disputes._rma_claims_list_.map(claim=>claim.id===decided.id?decided:claim)};
 assert.equal((await save(result,current.disputes)).status,200,'Simple RMA skips eligibility stages and stores one total result');
 await stop();await start();current=await read();
 assert.equal(current.disputes._rma_claims_list_.find(claim=>claim.id==='qa_direct1').stageStatus,'DIKEMBALIKAN_CS','Archive survives database reopen');
 assert.equal(current.disputes._rma_claims_list_.find(claim=>claim.id==='qa_simple2').approvedAmount,10000,'Typed total result survives reopen');
 console.log('PASS: simple RMA20000 claim/10000 result, isolated zero-input/unpriced handover, RMA valuation, stale-write rejection, ownership lock, explicit return and database reopen.');
}finally{await stop();}
