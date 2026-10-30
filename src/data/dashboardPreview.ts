import type {ProcessedReturnRow} from '../processor';
import type {MasterSKUItem} from '../utils/excelTemplate';
import {defaultRange} from '../utils/dashboardReport';
/** Read-only preview fixture, never written to storage or used unless dashboard-demo=1. */
export function dashboardPreview(now=new Date()){
 const end=defaultRange(30,now).end;
 const master:MasterSKUItem[]=[{SKU_ID:'DEMO-HOME-01',BARCODE:'DEMO-1001',SKU_NAME:'Set wadah penyimpanan',HARGA:185000},{SKU_ID:'DEMO-CARE-02',BARCODE:'DEMO-1002',SKU_NAME:'Paket perawatan wajah',HARGA:249000},{SKU_ID:'DEMO-ACC-03',BARCODE:'DEMO-1003',SKU_NAME:'Tas kanvas serbaguna',HARGA:79000}];
 const rows:ProcessedReturnRow[]=[];const disputes:Record<string,any>={};
 for(let day=59;day>=0;day--){
  const date=new Date(Date.parse(end+'T00:00:00Z')-day*86400000).toISOString().slice(0,10);
  const orders=day%11===0?0:(day*7+3)%9+2;
  for(let index=0;index<orders;index++){
   const order=`DEMO-${date.replace(/-/g,'')}-${index+1}`;
   const units=(day+index)%3+1;
   for(let unit=0;unit<units;unit++){
    const item=master[(day+index+unit)%master.length];
    const bad=(day+index+unit)%7===0;
    const row={Waktu_Proses:date+' 09:30:00',Order_ID:order,Operator_ID:'DEMO-GUDANG',SKU_ID:item.SKU_ID,Nama_Barang:item.SKU_NAME,Kondisi:bad?'Damage Product':'Good',Catatan_Tambahan:'Data demo',Video_Timestamp:date+' 09:30:00',Nama_File_Video:'',Link_Video:''} as ProcessedReturnRow;
    rows.push(row);
    if(bad){const key=`${order}__${item.SKU_ID}__${unit}`;disputes[key]={row,claimStatus:'PARTIAL',claimAmount:item.HARGA,approvedAmount:Math.round((item.HARGA ?? 0)*0.8),settlementAmount:Math.min(50000,Math.round((item.HARGA ?? 0)*0.8)),updatedAt:date+'T10:00:00+07:00'};}
   }
  }
 }
 return {rows,master,disputes};
}
