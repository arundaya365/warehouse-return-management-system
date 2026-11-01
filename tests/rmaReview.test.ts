import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedMarketplaceAmount,uncoveredClaimAmount,getEscalationError,rejectedItems,allocateClaimAmount,paymentStatus,validateRmaWorkflow,rmaCashReceived,isRmaClosed,marketplaceSettlement} from '../src/utils/claimWorkflow.ts';
import type {RmaClaimRecord} from '../src/types/rma.ts';
const record=(values:Partial<RmaClaimRecord>={}):RmaClaimRecord=>({id:'test',orderId:'TEST',channel:'JNE',stageStatus:'DIALIHKAN_KE_RMA',items:[],estimatedCompensation:200000,csNotes:'Rejected',forwardedBy:'CS',forwardedAt:'2026-10-29',updatedAt:'2026-10-29',rmaInvestigator:'RMA',...values});
test('partial marketplace decision reserves its approved portion even before payment',()=>{
 const item={claimStatus:'PARTIAL',claimAmount:300000,approvedAmount:100000,settlementAmount:0};
 assert.equal(approvedMarketplaceAmount(item),100000); assert.equal(uncoveredClaimAmount(item),200000);
 assert.equal(getEscalationError([item]),null); assert.equal(rejectedItems([item]).length,1);
 assert.equal(marketplaceSettlement({TEST__SKU__0:{...item,row:{Order_ID:'TEST',SKU_ID:'SKU'}}},new Set(['TEST'])).settlementAmount,0);
});
test('approval and payment allocations preserve exact totals and per-item caps',()=>{
 const approved=allocateClaimAmount(100000,[100000,200000]);
 assert.equal(approved.reduce((a,b)=>a+b,0),100000); assert.ok(approved[0]<=100000);
 assert.equal(allocateClaimAmount(50000,approved).reduce((a,b)=>a+b,0),50000);
 assert.throws(()=>allocateClaimAmount(300001,[100000,200000]));
});
test('payment waiting, partial and received are distinct',()=>{
 assert.equal(paymentStatus(100000,0),'WAITING'); assert.equal(paymentStatus(100000,20000),'PARTIAL'); assert.equal(paymentStatus(100000,100000),'RECEIVED');
});
test('rejection by a marketplace cannot directly authorize a logistics appeal',()=>{
 assert.ok(validateRmaWorkflow(record(),record({stageStatus:'DIAJUKAN_LOGISTIK',eligibility:'ELIGIBLE',logisticsTicket:'T'})));
 assert.equal(validateRmaWorkflow(record(),record({stageStatus:'DITERIMA_RMA'})),null);
});
test('RMA eligibility needs reasoning and evidence; missing evidence remains with RMA',()=>{
 const before=record({stageStatus:'DITERIMA_RMA'});
 assert.ok(validateRmaWorkflow(before,record({stageStatus:'LAYAK_LOGISTIK',eligibility:'ELIGIBLE',eligibilityReason:'Courier damage'})));
 assert.equal(validateRmaWorkflow(before,record({stageStatus:'BUKTI_KURANG',eligibility:'NEEDS_EVIDENCE',eligibilityReason:'Need delivery photos'})),null);
 assert.equal(validateRmaWorkflow(before,record({stageStatus:'TIDAK_LAYAK',eligibilityReason:'Not a carrier issue'})),null);
 assert.equal(isRmaClosed('TIDAK_LAYAK'),true);
});
test('an approved logistics result can wait for payment without inflating cash',()=>{
 const before=record({stageStatus:'MENUNGGU_LOGISTIK',eligibility:'ELIGIBLE'});
 const after=record({stageStatus:'HASIL_LOGISTIK',eligibility:'ELIGIBLE',logisticsTicket:'T',logisticsOutcome:'PARTIAL',approvedAmount:150000,approvedCompensation:0,resolutionNote:'Carrier approved 150000'});
 assert.equal(validateRmaWorkflow(before,after),null); assert.equal(rmaCashReceived(after),0);
 assert.ok(validateRmaWorkflow(after,{...after,stageStatus:'SELESAI'}));
 assert.equal(validateRmaWorkflow(after,{...after,stageStatus:'SELESAI',approvedCompensation:150000}),null);
 assert.equal(validateRmaWorkflow(after,{...after,stageStatus:'SELESAI',closureReason:'Owner accepts unpaid balance'}),null);
});
test('overpayment and reopening a closed case are blocked',()=>{
 const before=record({stageStatus:'HASIL_LOGISTIK',eligibility:'ELIGIBLE'});
 assert.ok(validateRmaWorkflow(before,{...before,logisticsTicket:'T',logisticsOutcome:'PARTIAL',approvedAmount:100000,approvedCompensation:100001,resolutionNote:'Done'}));
 assert.ok(validateRmaWorkflow(record({stageStatus:'TIDAK_LAYAK'}),record({stageStatus:'DITERIMA_RMA'})));
});
test('legacy explicit payout stays visible without converting approval into new money',()=>{
 assert.equal(rmaCashReceived(record({stageStatus:'SELESAI',approvedCompensation:70000})),70000);
 assert.equal(rmaCashReceived(record({stageStatus:'INVESTIGASI',approvedAmount:70000})),0);
});
import {validateClaimPayload} from '../src/utils/claimWorkflow.ts';
test('server accepts direct handover with atomic item snapshots and rejects invalid allocation',()=>{
 const source={row:{Order_ID:'TEST',SKU_ID:'SKU',Kondisi:'Damage Product'},claimStatus:'PENDING',claimAmount:300000,approvedAmount:0,settlementAmount:0};
 const claim=record({logisticsName:'JNE',handoverReason:'Perlu pemeriksaan logistik',handoverEvidence:'Video unboxing',estimatedCompensation:200000,items:[{sourceKey:'TEST__SKU__0',skuId:'SKU',namaBarang:'Test',qty:1,kondisi:'Damage Product',hargaSatuan:300000,subtotalEstimasi:200000}]});
 const payload={TEST__SKU__0:source,_rma_claims_list_:[claim]};
 assert.equal(validateClaimPayload({},payload),null);
 assert.equal(validateClaimPayload({}, {...payload,_rma_claims_list_:[{...claim,handoverEvidence:'',handoverReason:'',logisticsName:''}]}),null);
 assert.ok(validateClaimPayload({}, {...payload,_rma_claims_list_:[{...claim,estimatedCompensation:300001}]}));
 assert.ok(validateClaimPayload({}, {...payload,_rma_claims_list_:[{...claim,items:[...claim.items,...claim.items]}]}));
 assert.ok(validateClaimPayload({}, {...payload,_rma_claims_list_:[{...claim,id:'other'},claim]}));
});
