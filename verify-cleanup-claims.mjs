import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const order = 'QA-CLAIM-FLOW-20261029';
const db = new PGlite('../local-database');
const result = await db.query("select claim_data from disputes where order_id = '_rma_claims_list_'");
const claims = JSON.parse(result.rows[0]?.claim_data || '[]');
const qa = claims.filter(claim => claim.orderId === order);
if (qa.length !== 1 || qa[0].approvedCompensation !== 0 || qa[0].stageStatus !== 'SELESAI') throw Error('Restart persistence check failed');
console.log('RMA persistence after close/reopen: PASS');
await db.transaction(async tx => {
 await tx.query('delete from returns where order_id = $1',[order]);
 await tx.query('delete from disputes where order_id like $1',[order+'%']);
 await tx.query("update disputes set claim_data=$1 where order_id='_rma_claims_list_'",[JSON.stringify(claims.filter(claim => claim.orderId !== order))]);
});
await db.close();
const file = 'data/warehouse_sync_store.json';
if (fs.existsSync(file)) {
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 state.returns=state.returns.filter(row=>row.Order_ID!==order);
 for(const key of Object.keys(state.disputes || {})) if(key.startsWith(order)) delete state.disputes[key];
 if(Array.isArray(state.disputes?._rma_claims_list_)) state.disputes._rma_claims_list_=state.disputes._rma_claims_list_.filter(claim=>claim.orderId!==order);
 fs.writeFileSync(file,JSON.stringify(state,null,2));
}
console.log('Only the generated QA case was removed; all other records retained.');
