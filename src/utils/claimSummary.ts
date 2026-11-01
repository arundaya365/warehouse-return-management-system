import type {ProcessedReturnRow} from '../processor';
import type {MasterSKUItem} from './excelTemplate';
import type {RmaClaimRecord} from '../types/rma';
import {approvedMarketplaceAmount,normalizeOrderId,rmaCashReceived} from './claimWorkflow';
import {rowValue} from './reportValue';
export type LaneSummary={cases:number;submitted:number;approvedFull:number;approvedPartial:number;rejected:number;waiting:number;closed:number;requested:number;approved:number;received:number};
const lane=():LaneSummary=>({cases:0,submitted:0,approvedFull:0,approvedPartial:0,rejected:0,waiting:0,closed:0,requested:0,approved:0,received:0});
const money=(value:unknown)=>Math.max(0,Number(value)||0);
// Prefer canonical records over legacy aliases for each inspected physical unit.
export function uniqueMarketplaceRecords(disputes:Record<string,any>,orders:Set<string>):any[]{
 const unique=new Map<string,{record:any;canonical:boolean}>();
 for(const [key,record] of Object.entries(disputes)){
  if(key.startsWith('_')||!record?.row||!orders.has(normalizeOrderId(record.row.Order_ID)))continue;
  const identity=JSON.stringify([normalizeOrderId(record.row.Order_ID),record.row.SKU_ID,key.match(/(?:__|_)(\d+)$/)?.[1]||'0']);
  const canonical=key.includes('__');const old=unique.get(identity);
  if(!old||(canonical&&!old.canonical)||(canonical===old.canonical&&String(record.updatedAt||'')>String(old.record.updatedAt||'')))unique.set(identity,{record,canonical});
 }
 return [...unique.values()].map(value=>value.record);
}

/** Counts the claim lanes that still require a Finance receipt, once per order/lane. */
export function financeOutstandingCases(rows: ProcessedReturnRow[], disputes: Record<string, any>, rma: RmaClaimRecord[]) {
 const orders=new Set(rows.map(row=>normalizeOrderId(row.Order_ID)).filter(Boolean));
 const records=uniqueMarketplaceRecords(disputes,orders);
 let marketplace=0;
 for(const order of orders){
  const items=records.filter(item=>normalizeOrderId(item.row.Order_ID)===order);
  if(!items.length)continue;
  const explicit=items.find(item=>item.orderApprovedAmount!==undefined)?.orderApprovedAmount;
  const approved=explicit!==undefined?money(explicit):items.reduce((sum,item)=>sum+approvedMarketplaceAmount(item),0);
  const received=items.reduce((sum,item)=>sum+money(item.financeReceivedAmount!==undefined?item.financeReceivedAmount:item.settlementAmount),0);
  if(approved>received)marketplace++;
 }
 const logistics=rma.filter(claim=>{
  if(claim.stageStatus==='DIKEMBALIKAN_CS')return false;
  const approved=claim.logisticsOutcome==='REJECTED'?0:money(claim.approvedAmount??claim.approvedCompensation);
  const received=claim.financeReceivedAmount!==undefined?money(claim.financeReceivedAmount):rmaCashReceived(claim);
  return approved>received;
 }).length;
 return {marketplace,logistics,total:marketplace+logistics};
}
export function buildClaimSummary(rows:ProcessedReturnRow[],master:MasterSKUItem[],disputes:Record<string,any>,rma:RmaClaimRecord[]){
 const orders=new Set(rows.map(row=>normalizeOrderId(row.Order_ID)).filter(Boolean));
 const records=uniqueMarketplaceRecords(disputes,orders);
 const marketplace=lane(),logistics=lane();let loss=0,missingPrices=0,remaining=0,overpaid=0,needsReview=0;
 for(const order of orders){
  const items=records.filter(item=>normalizeOrderId(item.row.Order_ID)===order);
  const activeItems=items.filter(item=>item.claimStatus!=='PENDING');
  if(activeItems.length){
   marketplace.cases++;
   marketplace.requested+=activeItems.reduce((sum,item)=>sum+money(item.claimAmount),0);
   if(activeItems.some(item=>['SUBMITTED','WAITING','APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus)))marketplace.submitted++;
   const terminal=items.every(item=>['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus));
   if(!terminal)marketplace.waiting++;
   else if(items.every(item=>item.claimStatus==='APPROVED'))marketplace.approvedFull++;
   else if(items.every(item=>item.claimStatus==='REJECTED'))marketplace.rejected++;
   else marketplace.approvedPartial++;
  }
  if(items.length && items.every(item=>item.closedAt))marketplace.closed++;
  const orderApproved=items.find(item=>item.orderApprovedAmount!==undefined)?.orderApprovedAmount;
  const approved=orderApproved!==undefined?money(orderApproved):items.reduce((sum,item)=>sum+money(item.previousResolution?.approvedAmount)+approvedMarketplaceAmount(item),0);
  const received=items.reduce((sum,item)=>sum+money(item.previousResolution?.financeReceivedAmount ?? item.previousResolution?.settlementAmount)+(['APPROVED','PARTIAL'].includes(item.claimStatus)?money(item.financeReceivedAmount ?? item.settlementAmount):0),0);
  marketplace.approved+=approved;marketplace.received+=received;
  // Returned records remain history; they are not a second active logistics claim.
  const claims=rma.filter(claim=>normalizeOrderId(claim.orderId)===order&&claim.stageStatus!=='DIKEMBALIKAN_CS');
  let logisticsReceived=0;
  for(const claim of claims){
   logistics.cases++;
   const submitted=['DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus);
   if(submitted){logistics.submitted++;logistics.requested+=money(claim.estimatedCompensation);}
   if(['SELESAI','TIDAK_LAYAK'].includes(claim.stageStatus))logistics.closed++;
   const hasOutcome=['HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus);
   if(hasOutcome){
    const outcome=claim.logisticsOutcome;
    if(outcome==='APPROVED')logistics.approvedFull++;
    else if(outcome==='PARTIAL')logistics.approvedPartial++;
    else if(outcome==='REJECTED')logistics.rejected++;
    logistics.approved+=outcome==='REJECTED'?0:money(claim.approvedAmount??claim.approvedCompensation);
   }else if(claim.stageStatus!=='TIDAK_LAYAK')logistics.waiting++;
    logisticsReceived+=money((claim as any).previousResolution?.financeReceivedAmount ?? (claim as any).previousResolution?.approvedCompensation)+money((claim as any).financeReceivedAmount ?? rmaCashReceived(claim));
   if(claim.marketplaceCashAtHandover!==undefined&&received>claim.marketplaceCashAtHandover)needsReview++;
  }
  logistics.received+=logisticsReceived;
  const bad=rows.filter(row=>normalizeOrderId(row.Order_ID)===order&&row.Kondisi!=='Good');
  const known=bad.reduce((sum,row)=>{const value=rowValue(row,master);if(value===undefined)missingPrices++;return sum+(value??0);},0);
  // A logistics residual is not added again to the original marketplace loss.
  const declared=items.reduce((sum,item)=>sum+money(item.claimAmount),0);
  const logisticsBasis=claims.reduce((max,claim)=>Math.max(max,money(claim.estimatedCompensation)+approved),0);
  const orderLoss=Math.max(known,declared,logisticsBasis);
  loss+=orderLoss;remaining+=Math.max(0,orderLoss-received-logisticsReceived);overpaid+=Math.max(0,received+logisticsReceived-orderLoss);
 }
 return {loss,missingPrices,marketplace,logistics,cash:marketplace.received+logistics.received,remaining,overpaid,needsReview};
}
