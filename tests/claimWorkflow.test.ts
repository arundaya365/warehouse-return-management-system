import assert from 'node:assert/strict';
import test from 'node:test';
import { getEscalationError, rejectedItems, logisticsChannel, marketplaceSettlement, validateRmaResolution } from '../src/utils/claimWorkflow.ts';

test('CS may hand over drafts and pending marketplace decisions directly', () => {
  for (const claimStatus of ['PENDING','SUBMITTED','WAITING','REJECTED']) assert.equal(getEscalationError([{claimStatus,claimAmount:100}]),null);
  assert.ok(getEscalationError([{claimStatus:'APPROVED',claimAmount:100,approvedAmount:100}]));
  assert.ok(getEscalationError([]));
});

test('direct and partial handover preserve approved goods and exclude their reserved amount', () => {
  const items=[{sku:'paid',claimStatus:'APPROVED',claimAmount:100,approvedAmount:100},{sku:'draft',claimStatus:'PENDING',claimAmount:200},{sku:'partial',claimStatus:'PARTIAL',claimAmount:300,approvedAmount:100}];
  assert.equal(getEscalationError(items),null);
  assert.deepEqual(rejectedItems(items).map(item=>item.sku),['draft','partial']);
  assert.equal(items[0].claimStatus,'APPROVED');
});

test('double handover is blocked', () => assert.ok(getEscalationError([{claimStatus:'REJECTED'}], true)));
test('RMA channel is the logistics carrier, not the marketplace', () => {
  assert.equal(logisticsChannel('J&T'), 'J&T Express');
  assert.equal(logisticsChannel('SPX Express'), 'SPX Express');
  assert.equal(logisticsChannel('Shopee'), 'Lainnya');
});
test('canonical and legacy aliases cannot double recovery; underscores in order IDs are safe', () => {
  const row = {Order_ID:'ORDER_WITH_UNDERSCORES', SKU_ID:'SKU_A'};
  const records = {
    ORDER_WITH_UNDERSCORES__SKU_A__0: {row,claimStatus:'APPROVED',claimAmount:100000,settlementAmount:70000},
    ORDER_WITH_UNDERSCORES_SKU_A_0: {row,claimStatus:'APPROVED',claimAmount:100000,settlementAmount:100000},
  };
  assert.deepEqual(marketplaceSettlement(records,new Set(['ORDER_WITH_UNDERSCORES'])),{claimAmount:100000,settlementAmount:70000});
});
test('pending, rejected and unknown payouts never count as received cash', () => {
  const records:any = {};
  ['PENDING','SUBMITTED','REJECTED','APPROVED'].forEach((claimStatus,index) => {
    records[`ORDER__SKU__${index}`] = {row:{Order_ID:'ORDER',SKU_ID:'SKU'},claimStatus,claimAmount:100,settlementAmount:claimStatus==='APPROVED'?undefined:80};
  });
  assert.equal(marketplaceSettlement(records,new Set(['ORDER'])).settlementAmount,0);
});
test('RMA completion needs an explicit actual amount and explanation, including rejection with zero', () => {
  assert.ok(validateRmaResolution('SELESAI','','Rejected','Operator'));
  assert.ok(validateRmaResolution('SELESAI','0','','Operator'));
  assert.equal(validateRmaResolution('SELESAI','0','Ditolak logistik','Operator'),null);
  assert.ok(validateRmaResolution('SELESAI','-10','Invalid','Operator'));
  assert.ok(validateRmaResolution('INVESTIGASI','','',''));
});
