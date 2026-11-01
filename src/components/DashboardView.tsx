import React, { useMemo, useState } from 'react';
import { Download, Package, Boxes, ShieldAlert, Wallet, ClipboardList, Clock3, Truck } from 'lucide-react';
import { ProcessedReturnRow } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import { RmaClaimRecord } from '../types/rma';
import { buildDashboardReport, comparison, dashboardCsv, defaultRange, formatDashboardMoney, formatDashboardNumber, formatDashboardPercent, periodLabel, ReportRange } from '../utils/dashboardReport';
import { DashboardButton, DashboardState } from './dashboard/DashboardControls';
import { MetricCard } from './dashboard/MetricCard';
import { PeriodFilter } from './dashboard/PeriodFilter';
import { ChartPanel } from './dashboard/ChartPanel';
import { buildClaimSummary } from '../utils/claimSummary';
import { normalizeOrderId } from '../utils/claimWorkflow';
import './dashboard/dashboard.css';
interface DashboardViewProps {
 rows: ProcessedReturnRow[]; masterDatabase?: MasterSKUItem[]; rmaClaims?: RmaClaimRecord[]; disputes?: Record<string, any>;
 syncState?: 'idle'|'syncing'|'synced'|'error'|'offline'; lastUpdated?: Date|null; onRetry?:()=>Promise<unknown>; dataDemo?:boolean;
 onNavigateToStation?:()=>void; onNavigateToReports?:()=>void; onNavigateToDisputes?:()=>void; onNavigateToRma?:()=>void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({rows, masterDatabase=[], rmaClaims=[], disputes={}, syncState='idle', lastUpdated=null, onRetry, dataDemo=false}) => {
 const [range,setRange]=useState<ReportRange>(()=>defaultRange(30));
 const report=useMemo(()=>buildDashboardReport(rows,masterDatabase,disputes,rmaClaims,range),[rows,masterDatabase,disputes,rmaClaims,range]);
 const claims=useMemo(()=>buildClaimSummary(rows,masterDatabase,disputes,rmaClaims),[rows,masterDatabase,disputes,rmaClaims]);
 const loading=(syncState==='syncing'||syncState==='idle')&&!lastUpdated&&rows.length===0;
 const unavailable=!lastUpdated&&rows.length===0&&(syncState==='error'||syncState==='offline');
 const {current,previous}=report;
 const operational=useMemo(()=>{
   const damaged=new Set(['Damage Product','Damage Packaging','Totally Damage','Missing','Missing Item','Unexpected','Wrong Item']);
   const damagedOrders=new Set(rows.filter(row=>damaged.has(row.Kondisi)).map(row=>normalizeOrderId(row.Order_ID)).filter(Boolean));
   const rmaActive=new Set(rmaClaims.filter(claim=>claim.stageStatus!=='DIKEMBALIKAN_CS').map(claim=>normalizeOrderId(claim.orderId)).filter(Boolean));
   const statuses=new Map<string,Set<string>>();
   Object.values(disputes).forEach((record:any)=>{const order=normalizeOrderId(record?.row?.Order_ID);if(!order||!damagedOrders.has(order))return;const set=statuses.get(order)||new Set<string>();if(record.claimStatus)set.add(String(record.claimStatus));statuses.set(order,set);});
   const csQueue=[...damagedOrders].filter(order=>!rmaActive.has(order)&&!(statuses.get(order)?.size&&[...statuses.get(order)!].every(status=>status==='APPROVED')));
   const csCompleted=csQueue.filter(order=>[...(statuses.get(order)||new Set<string>())].some(status=>status==='PARTIAL'||status==='REJECTED')).length;
   const rmaQueue=[...rmaActive].filter(order=>damagedOrders.has(order));
   const rmaCompleted=rmaClaims.filter(claim=>rmaQueue.includes(normalizeOrderId(claim.orderId))&&(claim.logisticsOutcome==='PARTIAL'||claim.logisticsOutcome==='REJECTED')).length;
   return {openCs:csQueue.length,openRma:rmaQueue.length,csCompleted,rmaCompleted,csCompletion:csQueue.length?csCompleted/csQueue.length*100:0,rmaCompletion:rmaQueue.length?rmaCompleted/rmaQueue.length*100:0};
 },[rows,disputes,rmaClaims]);
 const logisticsBreakdown=useMemo(()=>{
   const byOrder=new Map<string,string>();
   report.filteredRows.forEach(row=>{const order=String(row.Order_ID||'').trim().toUpperCase();if(!order)return;const logistics=String(row.Ekspedisi||'').trim()||'Belum diketahui';if(!byOrder.has(order)||byOrder.get(order)==='Belum diketahui')byOrder.set(order,logistics);});
   const counts=new Map<string,number>();byOrder.forEach(value=>counts.set(value,(counts.get(value)||0)+1));
   const total=byOrder.size;return [...counts.entries()].map(([name,count])=>({name,count,pct:total?count/total*100:0})).sort((a,b)=>b.count-a.count);
 },[report.filteredRows]);
 const exportReport=()=>{const url=URL.createObjectURL(new Blob([dashboardCsv(report,masterDatabase)],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download=`laporan-retur-${range.start}-${range.end}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="dashboard-page" aria-labelledby="dashboard-title">
 <header className="dashboard-header"><div><div className="dashboard-eyebrow">IKHTISAR OPERASIONAL {dataDemo&&<span className="dashboard-demo">Data demo</span>}</div><h1 id="dashboard-title">Ringkasan Retur</h1><p>Pantau volume retur, kondisi barang, dan dana klaim dalam satu ringkasan.</p></div><DashboardButton onClick={exportReport} disabled={loading||unavailable}><Download size={16} aria-hidden="true"/>Ekspor Laporan</DashboardButton></header>
 <div className="dashboard-toolbar"><PeriodFilter range={range} onChange={setRange}/><div className="dashboard-period"><strong>{periodLabel(range)}</strong><span>{lastUpdated?`Terakhir diperbarui ${lastUpdated.toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}`:'Belum ada waktu sinkronisasi'}</span></div></div>
 <DashboardState state={syncState} loading={loading} hasData={rows.length>0} onRetry={onRetry}/>
 <div className="dashboard-metrics" aria-busy={loading}>
 <MetricCard title="Total Pesanan" value={formatDashboardNumber(current.orders)} icon={Package} comparison={comparison(current.orders,previous.orders)} loading={loading} unavailable={unavailable} index={0} note="Nomor pesanan unik"/>
 <MetricCard title="Total Barang" value={formatDashboardNumber(current.items)} icon={Boxes} comparison={comparison(current.items,previous.items)} loading={loading} unavailable={unavailable} index={1} note="Barang pada periode terpilih"/>
 <MetricCard title="Persentase Rusak" value={formatDashboardPercent(current.damagePct)} icon={ShieldAlert} comparison={comparison(current.damagePct,previous.damagePct,'damage')} loading={loading} unavailable={unavailable} index={2} note={`${formatDashboardNumber(current.damageCount)} barang rusak, hilang, atau salah kirim`}/>
 <MetricCard title="Estimasi Nilai" value={formatDashboardMoney(current.estimatedValue)} icon={Wallet} comparison={current.missingPrices||previous.missingPrices?{text:"Harga belum lengkap untuk dibandingkan",tone:"neutral"}:comparison(current.estimatedValue,previous.estimatedValue)} loading={loading} unavailable={unavailable} index={3} note={`Harga belum tersedia: ${formatDashboardNumber(current.missingPrices)} barang periode ini, ${formatDashboardNumber(previous.missingPrices)} sebelumnya`}/>
 <MetricCard title="Nilai Klaim Disetujui" value={formatDashboardMoney(claims.marketplace.approved+claims.logistics.approved)} icon={ClipboardList} comparison={{text:'Hasil keputusan CS dan RMA',tone:'neutral'}} loading={loading} unavailable={unavailable} index={4} note="Tidak termasuk dana yang sudah diterima Finance"/>
 </div><p className="dashboard-method">Perbandingan metrik retur terhadap {periodLabel(report.previousRange)}. Dashboard operasional hanya menampilkan hasil proses dan nominal keputusan; penerimaan dana tersedia di Dashboard Finance.{report.undatedCount>0&&` ${formatDashboardNumber(report.undatedCount)} baris tanpa tanggal valid dikecualikan dari metrik periode.`}</p>
 <section className="dashboard-operational" aria-labelledby="operational-priority-title"><header><div><h2 id="operational-priority-title">Prioritas operasional</h2><p>Antrean yang masih membutuhkan tindakan dari tim terkait.</p></div></header><div className="dashboard-operational-grid dashboard-operational-grid-two"><article className="dashboard-operational-card dashboard-operational-card-cs"><div className="dashboard-operational-icon"><ClipboardList size={18} aria-hidden="true"/></div><div><dt>Kasus CS terbuka</dt><dd>{loading||unavailable?'—':formatDashboardNumber(operational.openCs)}</dd><p>Completion rate: {loading||unavailable?'—':`${formatDashboardNumber(operational.csCompleted)} dari ${formatDashboardNumber(claims.marketplace.cases)} kasus · ${formatDashboardPercent(operational.csCompletion)}`}</p></div></article><article className="dashboard-operational-card dashboard-operational-card-rma"><div className="dashboard-operational-icon"><Clock3 size={18} aria-hidden="true"/></div><div><dt>Kasus RMA terbuka</dt><dd>{loading||unavailable?'—':formatDashboardNumber(operational.openRma)}</dd><p>Completion rate: {loading||unavailable?'—':`${formatDashboardNumber(operational.rmaCompleted)} dari ${formatDashboardNumber(claims.logistics.cases)} kasus · ${formatDashboardPercent(operational.rmaCompletion)}`}</p></div></article></div></section>
 <section className="dashboard-logistics" aria-labelledby="logistics-breakdown-title"><header><div><h2 id="logistics-breakdown-title">Komposisi logistik</h2><p>Persentase order retur berdasarkan ekspedisi pada {periodLabel(range)}.</p></div><Truck size={20} aria-hidden="true"/></header>{loading||unavailable?<p className="dashboard-logistics-empty">Menunggu data retur.</p>:logisticsBreakdown.length===0?<p className="dashboard-logistics-empty">Belum ada data ekspedisi pada periode ini.</p>:<div className="dashboard-logistics-list">{logisticsBreakdown.map(item=><div className="dashboard-logistics-row" key={item.name}><div className="dashboard-logistics-label"><strong>{item.name}</strong><span>{formatDashboardNumber(item.count)} order · {formatDashboardPercent(item.pct)}</span></div><div className="dashboard-logistics-track"><span style={{width:`${item.pct}%`}}/></div></div>)}</div>}</section>
 <ChartPanel buckets={report.buckets} rangeLabel={periodLabel(range)} unavailable={unavailable} loading={loading} empty={current.orders===0}/>
 <ClaimResults summary={claims} loading={loading} unavailable={unavailable}/></section>;
};


function ClaimResults({summary,loading,unavailable}:{summary:ReturnType<typeof buildClaimSummary>;loading:boolean;unavailable:boolean}) {
 const number=(amount:number)=>unavailable?'—':formatDashboardNumber(amount);
 const money=(amount:number)=>unavailable?'—':formatDashboardMoney(amount);
 const value=(text:string)=>loading?<span className="dashboard-skeleton dashboard-claim-skeleton" aria-hidden="true"/>:text;
 return <section className="dashboard-claim-results" aria-labelledby="claim-results-title" aria-busy={loading}>
  <header className="dashboard-claim-heading"><h2 id="claim-results-title">Hasil banding CS dan RMA</h2><p>Hasil keputusan dan dana masuk dicatat terpisah. Kasus ditutup tidak selalu berarti dana diterima penuh.</p></header>
  <dl className="dashboard-claim-totals">
   {[['Estimasi kerugian terdata',summary.loss],['Nilai klaim disetujui',summary.marketplace.approved+summary.logistics.approved],['Sisa kerugian terdata',summary.remaining]].map(([label,amount])=><div key={String(label)}><dt>{label}</dt><dd>{value(money(Number(amount)))}</dd></div>)}
  </dl>
  <div className="dashboard-claim-lanes">
   {([['CS · Marketplace',summary.marketplace],['RMA · Logistik',summary.logistics]] as const).map(([title,lane],index)=><article className="dashboard-claim-lane" key={title} aria-labelledby={'claim-lane-'+index}>
    <h3 id={'claim-lane-'+index}>{title}</h3>
    <dl className="dashboard-claim-money">
     {[['Nilai diajukan',lane.requested],['Nilai disetujui',lane.approved]].map(([label,amount])=><div key={String(label)}><dt>{label}</dt><dd>{value(money(Number(amount)))}</dd></div>)}
    </dl>
    <dl className="dashboard-claim-counts">
     {[['Kasus tercatat',lane.cases],['Sudah diproses',lane.submitted],['Disetujui penuh',lane.approvedFull],['Disetujui sebagian',lane.approvedPartial],['Banding tidak berhasil',lane.rejected],['Belum ada keputusan',lane.waiting],['Kasus ditutup',lane.closed],['Completion rate',lane.cases?`${formatDashboardNumber(lane.approvedPartial+lane.rejected)} dari ${formatDashboardNumber(lane.cases)} kasus · ${formatDashboardPercent((lane.approvedPartial+lane.rejected)/lane.cases*100)}`:'—']].map(([label,count])=><div key={String(label)}><dt>{label}</dt><dd>{loading?<span className="dashboard-skeleton dashboard-claim-skeleton" aria-hidden="true"/>:unavailable?'—':String(count)}</dd></div>)}
    </dl>
   </article>)}
  </div>
  {!loading&&!unavailable&&summary.missingPrices>0&&<p className="dashboard-claim-note">Harga belum tersedia untuk {number(summary.missingPrices)} barang. Estimasi dan sisa kerugian terdata belum mencakup seluruh barang.</p>}
  {!loading&&!unavailable&&summary.missingPrices===0&&summary.remaining>0&&<p className="dashboard-claim-warning" role="status">Masih ada sisa kerugian yang belum tertutup oleh hasil keputusan klaim. Rincian penerimaan dana tersedia di Dashboard Finance.</p>}
  <p className="dashboard-claim-note">{loading||unavailable?'Menunggu data dari server.':'Menampilkan seluruh hasil banding yang tersimpan, tidak dibatasi periode grafik. Satu retur dapat memiliki riwayat di kedua jalur; jumlah kasus CS dan RMA tidak dijumlahkan sebagai jumlah retur unik.'}</p>
 </section>;
}
