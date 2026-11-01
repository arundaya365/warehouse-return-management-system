import test from 'node:test';
import assert from 'node:assert/strict';
import {validateClaimPayload,validateRmaWorkflow,canReturnToCs,rmaQueue,getEscalationError} from '../src/utils/claimWorkflow.ts';
import {buildClaimSummary,financeOutstandingCases} from '../src/utils/claimSummary.ts';
import type {RmaClaimRecord} from '../src/types/rma.ts';
const row:any={Order_ID:'TEST',SKU_ID:'SKU',Kondisi:'Damage Product',Nama_Barang:'Produk'};
const source:any={row,claimStatus:'PARTIAL',claimAmount:500000,approvedAmount:200000,settlementAmount:100000,ticketNumber:'M1'};
const claim:RmaClaimRecord={id:'rma1',orderId:'TEST',channel:'JNE',logisticsName:'JNE',stageStatus:'DIALIHKAN_KE_RMA',handoverReason:'Periksa kerusakan saat pengiriman',handoverEvidence:'Video1',items:[{sourceKey:'TEST__SKU__0',skuId:'SKU',namaBarang:'Produk',qty:1,kondisi:'Damage Product',hargaSatuan:500000,subtotalEstimasi:300000}],estimatedCompensation:300000,csNotes:'Periksa',forwardedBy:'CS',forwardedAt:'2026-10-31T01:00:00Z',updatedAt:'2026-10-31T01:00:00Z',marketplaceCashAtHandover:100000};
test('return preserves the RMA archive, unlocks CS only after explicit transition, and permits a new handover',()=>{
 const returned={...claim,stageStatus:'DIKEMBALIKAN_CS' as const,returnReason:'Bukti mengarah ke marketplace',returnedBy:'RMA',returnedAt:'2026-10-31T02:00:00Z'};
 assert.equal(validateRmaWorkflow(claim,returned),null);
 assert.equal(rmaQueue(returned.stageStatus),'RETURNED');
 assert.equal(canReturnToCs('DIAJUKAN_LOGISTIK'),false);
 assert.ok(validateRmaWorkflow({...claim,stageStatus:'DIAJUKAN_LOGISTIK'},returned));
 assert.ok(validateRmaWorkflow(claim,{...returned,returnReason:''}));
 const previous={TEST__SKU__0:source,_rma_claims_list_:[returned]};
 assert.equal(validateClaimPayload(previous,{...previous,_rma_claims_list_:[returned,{...claim,id:'rma2'}]}),null);
 assert.ok(validateClaimPayload(previous,{...previous,_rma_claims_list_:[{...returned,csNotes:'tamper'}]}));
});
test('marketplace decisions are locked during RMA ownership but an actual receipt may be recorded',()=>{
 const previous={TEST__SKU__0:source,_rma_claims_list_:[claim]};
 assert.ok(validateClaimPayload(previous,{...previous,TEST__SKU__0:{...source,claimStatus:'APPROVED'}}));
 assert.equal(validateClaimPayload(previous,{...previous,TEST__SKU__0:{...source,settlementAmount:200000}}),null);
 assert.ok(validateClaimPayload(previous,{...previous,TEST__SKU__0:{...source,settlementAmount:200001}}));
});
test('dashboard keeps two outcomes separate and sums only receipts without adding logistics loss twice',()=>{
 const paid={...claim,stageStatus:'SELESAI' as const,logisticsOutcome:'PARTIAL' as const,approvedAmount:250000,approvedCompensation:250000};
 const summary=buildClaimSummary([row],[{SKU_ID:'SKU',HARGA:500000}] as any,{TEST__SKU__0:source,TEST_SKU_0:source},[paid]);
 assert.equal(summary.loss,500000);assert.equal(summary.cash,350000);assert.equal(summary.remaining,150000);
 assert.equal(summary.marketplace.approvedPartial,1);assert.equal(summary.logistics.approvedPartial,1);assert.equal(summary.logistics.closed,1);
});
test('direct handover does not invent a marketplace application; rejection and closure do not imply success',()=>{
 const rejected={...claim,stageStatus:'SELESAI' as const,logisticsOutcome:'REJECTED' as const,approvedAmount:0,approvedCompensation:0};
 const summary=buildClaimSummary([row],[],{TEST__SKU__0:{...source,claimStatus:'PENDING',approvedAmount:0,settlementAmount:0}},[rejected]);
 assert.equal(summary.marketplace.cases,0);assert.equal(summary.marketplace.submitted,0);
 assert.equal(summary.logistics.rejected,1);assert.equal(summary.logistics.approvedFull,0);assert.equal(summary.cash,0);assert.equal(summary.missingPrices,1);
});
test('late marketplace receipts flag RMA review and overpayment is visible rather than negative loss',()=>{
 const paid={...claim,stageStatus:'SELESAI' as const,logisticsOutcome:'APPROVED' as const,approvedAmount:300000,approvedCompensation:300000};
 const summary=buildClaimSummary([row],[],{TEST__SKU__0:{...source,settlementAmount:200000}},[paid]);
 assert.equal(summary.needsReview,1);assert.equal(summary.remaining,0);assert.equal(summary.cash,500000);
});
test('returned RMA archives do not inflate active claim count or requested value',()=>{
 const returned={...claim,stageStatus:'DIKEMBALIKAN_CS' as const};
 const summary=buildClaimSummary([row],[],{TEST__SKU__0:source},[returned,claim]);
 assert.equal(summary.logistics.cases,1);assert.equal(summary.logistics.requested,0);
});
test('Finance outstanding badge counts only claim lanes with an unpaid approved balance',()=>{
 const marketplace={...source,orderApprovedAmount:200000,financeReceivedAmount:50000};
 const logisticsUnpaid={...claim,id:'rma-unpaid',stageStatus:'SELESAI' as const,logisticsOutcome:'PARTIAL' as const,approvedAmount:100000,financeReceivedAmount:0};
 const logisticsPaid={...claim,id:'rma-paid',orderId:'OTHER',stageStatus:'SELESAI' as const,logisticsOutcome:'APPROVED' as const,approvedAmount:50000,financeReceivedAmount:50000};
 const counts=financeOutstandingCases([row],{TEST__SKU__0:marketplace},[logisticsUnpaid,logisticsPaid]);
 assert.deepEqual(counts,{marketplace:1,logistics:1,total:2});
});

test('CS closure requires a terminal decision and reason, while rejected is not payment success',()=>{
 const previous={TEST__SKU__0:{...source,csNotes:'Marketplace menolak'}};
 assert.ok(validateClaimPayload(previous,{...previous,TEST__SKU__0:{...previous.TEST__SKU__0,claimStatus:'PENDING',closedAt:'2026-10-31',closureReason:'Selesai'}}));
 assert.ok(validateClaimPayload(previous,{...previous,TEST__SKU__0:{...previous.TEST__SKU__0,claimStatus:'REJECTED',approvedAmount:0,settlementAmount:0,closedAt:'2026-10-31',closureReason:''}}));
 const closed={...previous.TEST__SKU__0,claimStatus:'REJECTED',approvedAmount:0,settlementAmount:0,closedAt:'2026-10-31',closureReason:'Tidak ada bukti tambahan'};
 assert.equal(validateClaimPayload(previous,{TEST__SKU__0:closed}),null);
 const summary=buildClaimSummary([row],[],{TEST__SKU__0:closed},[]);
 assert.equal(summary.marketplace.closed,1);assert.equal(summary.marketplace.rejected,1);assert.equal(summary.cash,0);
});
test('unknown-price unresolved items can move immediately, while archives cannot be omitted',()=>{
 assert.equal(getEscalationError([{claimStatus:'PENDING',claimAmount:100},{claimStatus:'PENDING',claimAmount:0}]),null);
 assert.ok(validateClaimPayload({_rma_claims_list_:[claim]},{}));
 assert.ok(validateClaimPayload({_rma_claims_list_:[claim]},{_rma_claims_list_:[]}));
});

test('one-click handover accepts no ticket, no evidence entry and no known price',()=>{
 const unknownSource={row,claimStatus:'PENDING',claimAmount:0,approvedAmount:0,settlementAmount:0};
 const unknown={...claim,logisticsName:'',handoverReason:'',handoverEvidence:'',estimatedCompensation:0,items:[{...claim.items[0],sourceClaimAmount:0,marketplaceReservedAmount:0,valuationPending:true,hargaSatuan:0,subtotalEstimasi:0}]};
 assert.equal(validateClaimPayload({}, {TEST__SKU__0:unknownSource,_rma_claims_list_:[unknown]}),null);
 const valued={...unknown,stageStatus:'DITERIMA_RMA' as const,rmaInvestigator:'RMA',estimatedCompensation:150000,items:unknown.items.map(item=>({...item,subtotalEstimasi:150000}))};
 assert.equal(validateClaimPayload({TEST__SKU__0:unknownSource,_rma_claims_list_:[unknown]}, {TEST__SKU__0:unknownSource,_rma_claims_list_:[valued]}),null);
 assert.ok(validateRmaWorkflow({...valued,stageStatus:'DIAJUKAN_LOGISTIK'},{...valued,stageStatus:'DIAJUKAN_LOGISTIK',estimatedCompensation:160000,items:valued.items.map(item=>({...item,subtotalEstimasi:160000}))}));
});
test('logistics submission uses the AWB as reference and does not require an extra ticket',()=>{
 const before={...claim,stageStatus:'DRAF_LOGISTIK' as const,eligibility:'ELIGIBLE' as const,rmaInvestigator:'RMA'};
 assert.equal(validateRmaWorkflow(before,{...before,stageStatus:'DIAJUKAN_LOGISTIK',logisticsTicket:''}),null);
 const unknown={...before,estimatedCompensation:0,items:before.items.map(item=>({...item,subtotalEstimasi:0}))};
 assert.ok(validateRmaWorkflow(unknown,{...unknown,stageStatus:'DIAJUKAN_LOGISTIK'}));
});
test('RMA cannot value known goods above their reserved marketplace remainder',()=>{
 const before={...claim,stageStatus:'DITERIMA_RMA' as const,rmaInvestigator:'RMA',items:claim.items.map(item=>({...item,sourceClaimAmount:500000,marketplaceReservedAmount:200000}))};
 assert.ok(validateRmaWorkflow(before,{...before,estimatedCompensation:400000,items:before.items.map(item=>({...item,subtotalEstimasi:400000}))}));
});

import {classifyApprovedAmount} from '../src/utils/claimWorkflow.ts';
test('policy deductions allow a lower decision than product/claim value without inventing cash',()=>{
 assert.equal(classifyApprovedAmount(7000,10000),'PARTIAL');
 assert.equal(classifyApprovedAmount(5000,10000),'PARTIAL');
 assert.equal(classifyApprovedAmount(10000,10000),'APPROVED');
 assert.equal(classifyApprovedAmount(0,10000),undefined);
 assert.equal(classifyApprovedAmount(11000,10000),undefined);
 const before={...claim,estimatedCompensation:10000,items:[{...claim.items[0],hargaSatuan:10000,subtotalEstimasi:10000}],stageStatus:'MENUNGGU_LOGISTIK' as const,eligibility:'ELIGIBLE' as const,rmaInvestigator:'RMA'};
 const after={...before,stageStatus:'HASIL_LOGISTIK' as const,approvedAmount:7000,approvedCompensation:5000,logisticsOutcome:'PARTIAL' as const,resolutionNote:'Potongan sesuai keputusan ekspedisi'};
 assert.equal(validateRmaWorkflow(before,after),null);
 const summary=buildClaimSummary([row],[{SKU_ID:'SKU',HARGA:10000}] as any,{},[after]);
 assert.equal(summary.logistics.approved,7000);assert.equal(summary.logistics.received,5000);assert.equal(summary.remaining,5000);
});
test('marketplace policy deductions preserve the separate approved and received amounts',()=>{
 const item={row,claimStatus:'PARTIAL',claimAmount:10000,approvedAmount:7000,settlementAmount:5000,csNotes:'Potongan biaya sesuai keputusan marketplace'};
 const summary=buildClaimSummary([row],[{SKU_ID:'SKU',HARGA:10000}] as any,{TEST__SKU__0:item},[]);
 assert.equal(summary.marketplace.approved,7000);assert.equal(summary.marketplace.received,5000);assert.equal(summary.remaining,5000);assert.equal(summary.marketplace.approvedPartial,1);
});

import {simpleRmaStatus,simpleRmaStage} from '../src/utils/claimWorkflow.ts';
test('simple RMA accepts two SKUs totaling20000 and one manually typed10000 result without eligibility steps',()=>{
 const items=['A','B'].map(sku=>({sourceKey:'TEST__'+sku+'__0',skuId:sku,namaBarang:sku,qty:1,kondisi:'Damage Product',hargaSatuan:10000,subtotalEstimasi:10000}));
 const previous={...claim,items,estimatedCompensation:20000};
 const next={...previous,workflowVersion:'SIMPLE' as const,claimStatus:'PARTIAL' as const,stageStatus:'HASIL_LOGISTIK' as const,rmaInvestigator:'RMA',approvedAmount:10000,approvedCompensation:0,logisticsOutcome:'PARTIAL' as const};
 assert.equal(validateRmaWorkflow(previous,next),null);
 assert.equal(simpleRmaStatus(next),'APPROVED');assert.equal(simpleRmaStage('PARTIAL'),'HASIL_LOGISTIK');
 assert.equal(validateClaimPayload({_rma_claims_list_:[previous]},{_rma_claims_list_:[next]}),null);
 const summary=buildClaimSummary([row],[{SKU_ID:'SKU',HARGA:20000}] as any,{},[next]);
 assert.equal(summary.logistics.approved,10000);assert.equal(summary.logistics.received,0);
});
test('simple RMA can move between draft, submitted and waiting without extra proof or ticket fields',()=>{
 const before={...claim,rmaInvestigator:'RMA'};
 for(const status of ['PENDING','SUBMITTED','WAITING'] as const){
  const next={...before,workflowVersion:'SIMPLE' as const,claimStatus:status,stageStatus:simpleRmaStage(status),approvedAmount:0,approvedCompensation:0,logisticsOutcome:undefined};
  assert.equal(validateRmaWorkflow(before,next),null);
 }
});
test('simplified rejection remains zero and cannot erase prior actual receipts',()=>{
 const before={...claim,stageStatus:'HASIL_LOGISTIK' as const,workflowVersion:'SIMPLE' as const,claimStatus:'PARTIAL' as const,rmaInvestigator:'RMA',approvedAmount:100000,approvedCompensation:50000,logisticsOutcome:'PARTIAL' as const};
 const rejected={...before,claimStatus:'REJECTED' as const,logisticsOutcome:'REJECTED' as const,approvedAmount:0,approvedCompensation:0};
 assert.ok(validateRmaWorkflow(before,rejected));
 assert.equal(validateRmaWorkflow({...before,approvedCompensation:0},rejected),null);
 assert.ok(validateRmaWorkflow(before,{...before,approvedCompensation:49999}));
 assert.equal(validateRmaWorkflow(before,{...before,approvedCompensation:70000}),null);
});
test('super-account reopen is a one-time audited exception and old money remains counted',()=>{
 const closedSource={...source,claimStatus:'PARTIAL',approvedAmount:200000,settlementAmount:100000,closedAt:'2026-10-31',closureReason:'Selesai'};
 const reopenedSource={...closedSource,claimStatus:'PENDING',approvedAmount:0,settlementAmount:0,closedAt:undefined,closureReason:undefined,reopenedAt:'2026-11-01',reopenedBySuperAccount:'Admin',reopenReason:'Periksa ulang',previousResolution:{claimStatus:'PARTIAL',approvedAmount:200000,settlementAmount:100000,closedAt:'2026-10-31',closureReason:'Selesai'}};
 assert.ok(validateClaimPayload({TEST__SKU__0:closedSource},{TEST__SKU__0:reopenedSource}));
 assert.equal(validateClaimPayload({TEST__SKU__0:closedSource},{TEST__SKU__0:reopenedSource},true),null);
 const unsafeFollowup={...reopenedSource,claimStatus:'APPROVED',approvedAmount:999999};
 assert.ok(validateClaimPayload({TEST__SKU__0:reopenedSource},{TEST__SKU__0:unsafeFollowup},true));
 const summary=buildClaimSummary([row],[{SKU_ID:'SKU',HARGA:500000}] as any,{TEST__SKU__0:reopenedSource},[]);
 assert.equal(summary.marketplace.approved,200000);assert.equal(summary.marketplace.received,100000);
});
