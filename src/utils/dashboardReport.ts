import type {ProcessedReturnRow} from '../processor';
import type {MasterSKUItem} from './excelTemplate';
import type {RmaClaimRecord} from '../types/rma';
import {marketplaceSettlement,normalizeOrderId,rmaCashReceived} from './claimWorkflow';
import {rowValue,summarizeValues} from './reportValue';

export type ReportRange={start:string;end:string};
export type DashboardMetrics={orders:number;items:number;damageCount:number;damagePct:number;estimatedValue:number;missingPrices:number;claimCash:number};
export type DashboardReport={range:ReportRange;previousRange:ReportRange;current:DashboardMetrics;previous:DashboardMetrics;buckets:{date:string;orders:number;items:number;damageCount:number}[];filteredRows:ProcessedReturnRow[];undatedCount:number};
const DAY=86400000;
const damaged=new Set(['Damage Product','Damage Packaging','Totally Damage','Missing','Missing Item','Unexpected','Wrong Item']);
function timestamp(date:string):number{return Date.parse(date+'T00:00:00Z');}
export function validDate(date:string):boolean{return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(timestamp(date))&&new Date(timestamp(date)).toISOString().slice(0,10)===date;}
function shift(date:string,days:number):string{return new Date(timestamp(date)+days*DAY).toISOString().slice(0,10);}
export function defaultRange(days:7|30,now=new Date()):ReportRange{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const find=(type:string)=>parts.find(p=>p.type===type)!.value;
 const end=`${find('year')}-${find('month')}-${find('day')}`;
 return {start:shift(end,1-days),end};
}
export function validateReportRange(range:ReportRange):string|null{
 if(!validDate(range.start)||!validDate(range.end))return 'Isi tanggal mulai dan tanggal akhir yang valid.';
 if(range.start>range.end)return 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.';
 if((timestamp(range.end)-timestamp(range.start))/DAY>=366)return 'Pilih rentang maksimal 366 hari agar grafik tetap mudah dibaca.';
 return null;
}
export function previousRange(range:ReportRange):ReportRange{
 if(validateReportRange(range))throw new Error('Rentang tanggal tidak valid.');
 const days=(timestamp(range.end)-timestamp(range.start))/DAY+1;
 return {start:shift(range.start,-days),end:shift(range.start,-1)};
}
function rowDate(row:ProcessedReturnRow):string|undefined{
 for(const value of [row.Waktu_Proses,row.Video_Timestamp]){
  const match=String(value||'').match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if(match){const date=match.slice(1).join('-');if(validDate(date))return date;}
 }
 return undefined;
}
export function buildDashboardReport(rows:ProcessedReturnRow[],master:MasterSKUItem[]=[],disputes:Record<string,any>={},rma:RmaClaimRecord[]=[],range:ReportRange):DashboardReport{
 const error=validateReportRange(range);if(error)throw new Error(error);
 const prev=previousRange(range);
 const dated=rows.map(row=>({row,date:rowDate(row)}));
 const select=(period:ReportRange)=>dated.filter(({date})=>date&&date>=period.start&&date<=period.end).map(({row})=>row);
 const metrics=(items:ProcessedReturnRow[]):DashboardMetrics=>{
  const orderIds=new Set(items.map(row=>normalizeOrderId(row.Order_ID)).filter(Boolean));
  const values=summarizeValues(items,master);
  const bad=items.filter(row=>damaged.has(row.Kondisi)).length;
  const cash=marketplaceSettlement(disputes,orderIds).settlementAmount+rma.filter(claim=>orderIds.has(normalizeOrderId(claim.orderId))).reduce((sum,claim)=>sum+rmaCashReceived(claim),0);
  return {orders:orderIds.size,items:items.length,damageCount:bad,damagePct:items.length?bad/items.length*100:0,estimatedValue:values.total,missingPrices:values.missing,claimCash:cash};
 };
 const filteredRows=select(range);
 const buckets:DashboardReport['buckets']=[];
 for(let date=range.start;date<=range.end;date=shift(date,1)){
  const daily=dated.filter(entry=>entry.date===date).map(entry=>entry.row);
  buckets.push({date,orders:new Set(daily.map(row=>normalizeOrderId(row.Order_ID)).filter(Boolean)).size,items:daily.length,damageCount:daily.filter(row=>damaged.has(row.Kondisi)).length});
 }
 return {range:{...range},previousRange:prev,current:metrics(filteredRows),previous:metrics(select(prev)),buckets,filteredRows,undatedCount:dated.filter(entry=>!entry.date).length};
}
export const formatDashboardNumber=(value:number)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(value);
export const formatDashboardMoney=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
export const formatDashboardPercent=(value:number)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(value)+'%';
export function periodLabel(range:ReportRange):string{
 const f=(date:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(timestamp(date)));
 return f(range.start)+' – '+f(range.end);
}
export function comparison(current:number,previous:number,mode:'neutral'|'damage'='neutral'):{text:string;tone:'neutral'|'good'|'bad'}{
 if(mode==='damage'){
  const delta=current-previous;
  const amount=new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(Math.abs(delta));
  return {text:Math.abs(delta)<0.0001?'Tidak berubah dari periode sebelumnya':`${delta>0?'Naik':'Turun'} ${amount} poin persentase`,tone:Math.abs(delta)<0.0001?'neutral':delta>0?'bad':'good'};
 }
 if(previous===0)return {text:current===0?'Belum ada perubahan':'Belum ada nilai pembanding',tone:'neutral'};
 const change=(current-previous)/previous*100;
 return {text:Math.abs(change)<0.0001?'Tidak berubah dari periode sebelumnya':`${change>0?'Naik':'Turun'} ${new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(Math.abs(change))}% dari periode sebelumnya`,tone:'neutral'};
}
function cell(value:unknown):string{
 let text=String(value??'');if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function dashboardCsv(report:DashboardReport,master:MasterSKUItem[]):string{
 const header=['Periode mulai','Periode akhir','Waktu pemeriksaan','Nomor pesanan','SKU','Nama barang','Kondisi','Estimasi nilai (Rp)','Status harga'];
 const rows=report.filteredRows.map(row=>{const price=rowValue(row,master);return [report.range.start,report.range.end,row.Waktu_Proses,row.Order_ID,row.SKU_ID,row.Nama_Barang,row.Kondisi,price??'',price===undefined?'Harga belum tersedia':'Harga master SKU saat ini'];});
 return '\uFEFF'+[header,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
