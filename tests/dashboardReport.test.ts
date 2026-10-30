import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDashboardReport,comparison,dashboardCsv,defaultRange,previousRange,validateReportRange} from '../src/utils/dashboardReport';
import type {ProcessedReturnRow} from '../src/processor';
import type {MasterSKUItem} from '../src/utils/excelTemplate';
import type {RmaClaimRecord} from '../src/types/rma';
const row=(date:string,order='ORD-1',sku='SKU',condition='Good')=>({Waktu_Proses:date+' 23:59:59',Video_Timestamp:'',Operator_ID:'QA',Order_ID:order,SKU_ID:sku,Nama_Barang:'Barang',Kondisi:condition,Catatan_Tambahan:'',Nama_File_Video:'',Link_Video:''}) as ProcessedReturnRow;
const master=[{SKU_ID:'SKU',BARCODE:'111',SKU_NAME:'Barang',HARGA:100000}] as MasterSKUItem[];
test('preset periods use warehouse calendar dates and equal inclusive previous periods',()=>{
 assert.deepEqual(defaultRange(7,new Date('2026-10-30T18:00:00Z')),{start:'2026-10-25',end:'2026-10-31'});
 assert.deepEqual(previousRange({start:'2026-10-25',end:'2026-10-31'}),{start:'2026-10-18',end:'2026-10-24'});
 assert.ok(validateReportRange({start:'2026-02-30',end:'2026-03-01'}));
 assert.ok(validateReportRange({start:'2026-10-31',end:'2026-10-30'}));
 assert.ok(validateReportRange({start:'2025-01-01',end:'2026-12-31'}));
});
test('the same filter controls metrics, chart and export, with zero-filled daily buckets',()=>{
 const rows=[row('2026-10-30'),row('2026-10-30','ORD-1','UNKNOWN','Missing'),row('2026-10-29','ORD-2'),row('2026-10-27','PREV'),row('bad-date','UNDATED')];
 const report=buildDashboardReport(rows,master,{},[],{start:'2026-10-29',end:'2026-10-31'});
 assert.equal(report.current.orders,2);assert.equal(report.current.items,3);assert.ok(Math.abs(report.current.damagePct-100/3)<0.000001);assert.equal(report.current.estimatedValue,200000);assert.equal(report.current.missingPrices,1);
 assert.equal(report.previous.items,1);assert.equal(report.undatedCount,1);assert.deepEqual(report.buckets.map(day=>day.orders),[1,1,0]);
 const csv=dashboardCsv(report,master);assert.ok(csv.includes('ORD-2'));assert.ok(!csv.includes('PREV'));assert.ok(!csv.includes('UNDATED'));
});
test('cash counts actual marketplace and logistics receipts for the return cohort, once per alias',()=>{
 const original=row('2026-10-30');const claim={row:original,claimAmount:100000,approvedAmount:80000,settlementAmount:50000,claimStatus:'PARTIAL'};
 const disputes={'ORD-1__SKU__0':claim,'ORD-1_SKU_0':claim,'outside':{...claim,row:row('2026-09-01','OTHER'),settlementAmount:900000}};
 const rma=[{orderId:'ORD-1',stageStatus:'HASIL_LOGISTIK',approvedAmount:20000,approvedCompensation:10000}] as RmaClaimRecord[];
 const report=buildDashboardReport([original],master,disputes,rma,{start:'2026-10-30',end:'2026-10-30'});
 assert.equal(report.current.claimCash,60000);
});
test('comparisons avoid infinity and distinguish adverse damage changes in percentage points',()=>{
 assert.equal(comparison(10,0).tone,'neutral');assert.ok(!/Infinity|NaN/.test(comparison(10,0).text));
 assert.equal(comparison(20,10).tone,'neutral');assert.equal(comparison(20,10,'damage').tone,'bad');assert.match(comparison(20,10,'damage').text,/10 poin persentase/);
 assert.equal(comparison(5,10,'damage').tone,'good');assert.equal(comparison(0,0,'damage').tone,'neutral');
});
test('CSV escapes formulas and preserves zero prices without mutating source records',()=>{
 const source=row('2026-10-30');source.Nama_Barang='=HYPERLINK("https://example.test")';
 const report=buildDashboardReport([source],[{...master[0],HARGA:0}],{},[],{start:'2026-10-30',end:'2026-10-30'});
 const csv=dashboardCsv(report,[{...master[0],HARGA:0}]);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"0"'));assert.ok(source.Nama_Barang.startsWith('='));
});
