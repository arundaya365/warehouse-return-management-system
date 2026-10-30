import React, { useMemo, useState } from 'react';
import { Download, Package, Boxes, ShieldAlert, Wallet, Banknote } from 'lucide-react';
import { ProcessedReturnRow } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import { RmaClaimRecord } from '../types/rma';
import { buildDashboardReport, comparison, dashboardCsv, defaultRange, formatDashboardMoney, formatDashboardNumber, formatDashboardPercent, periodLabel, ReportRange } from '../utils/dashboardReport';
import { DashboardButton, DashboardState } from './dashboard/DashboardControls';
import { MetricCard } from './dashboard/MetricCard';
import { PeriodFilter } from './dashboard/PeriodFilter';
import { ChartPanel } from './dashboard/ChartPanel';
import './dashboard/dashboard.css';
interface DashboardViewProps {
 rows: ProcessedReturnRow[]; masterDatabase?: MasterSKUItem[]; rmaClaims?: RmaClaimRecord[]; disputes?: Record<string, any>;
 syncState?: 'idle'|'syncing'|'synced'|'error'|'offline'; lastUpdated?: Date|null; onRetry?:()=>Promise<unknown>; dataDemo?:boolean;
 onNavigateToStation?:()=>void; onNavigateToReports?:()=>void; onNavigateToDisputes?:()=>void; onNavigateToRma?:()=>void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({rows, masterDatabase=[], rmaClaims=[], disputes={}, syncState='idle', lastUpdated=null, onRetry, dataDemo=false}) => {
 const [range,setRange]=useState<ReportRange>(()=>defaultRange(30));
 const report=useMemo(()=>buildDashboardReport(rows,masterDatabase,disputes,rmaClaims,range),[rows,masterDatabase,disputes,rmaClaims,range]);
 const loading=(syncState==='syncing'||syncState==='idle')&&!lastUpdated&&rows.length===0;
 const unavailable=!lastUpdated&&rows.length===0&&(syncState==='error'||syncState==='offline');
 const {current,previous}=report;
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
 <MetricCard title="Dana Klaim" value={formatDashboardMoney(current.claimCash)} icon={Banknote} comparison={comparison(current.claimCash,previous.claimCash)} loading={loading} unavailable={unavailable} index={4} note="Dana tercatat untuk pesanan retur periode ini"/>
 </div><p className="dashboard-method">Perbandingan terhadap {periodLabel(report.previousRange)}. Dana klaim mengikuti tanggal retur pesanan, bukan tanggal pembayaran.{report.undatedCount>0&&` ${formatDashboardNumber(report.undatedCount)} baris tanpa tanggal valid dikecualikan.`}</p>
 <ChartPanel buckets={report.buckets} rangeLabel={periodLabel(range)} unavailable={unavailable} loading={loading} empty={current.orders===0}/></section>;
};
