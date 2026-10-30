import test from 'node:test';
import assert from 'node:assert/strict';
import {RMA_TRANSITIONS, rmaQueue, rmaActionLabel} from '../src/utils/claimWorkflow';
test('RMA action choices preserve review before submission and never reopen closed cases',()=>{
 assert.deepEqual(RMA_TRANSITIONS.DIALIHKAN_KE_RMA,['DITERIMA_RMA']);
 assert.deepEqual(RMA_TRANSITIONS.DITERIMA_RMA,['BUKTI_KURANG','LAYAK_LOGISTIK','TIDAK_LAYAK']);
 assert.equal(RMA_TRANSITIONS.SELESAI,undefined);
 assert.equal(RMA_TRANSITIONS.TIDAK_LAYAK,undefined);
 assert.equal(rmaActionLabel('HASIL_LOGISTIK'),'Catat keputusan logistik');
});
test('RMA queues distinguish acceptance, work, waiting and closure',()=>{
 assert.equal(rmaQueue('DIALIHKAN_KE_RMA'),'RECEIVE');
 assert.equal(rmaQueue('DITERIMA_RMA'),'ACTIVE');
 assert.equal(rmaQueue('HASIL_LOGISTIK'),'WAITING');
 assert.equal(rmaQueue('BUKTI_KURANG'),'WAITING');
 assert.equal(rmaQueue('TIDAK_LAYAK'),'CLOSED');
 assert.equal(rmaQueue('SELESAI'),'CLOSED');
});
