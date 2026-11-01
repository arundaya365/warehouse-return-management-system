import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, CircleDollarSign, Download, Filter, Search, WalletCards, X } from 'lucide-react';
import type { ProcessedReturnRow } from '../processor';
import type { RmaClaimRecord } from '../types/rma';
import type { StoreProfile } from '../types/store';
import { approvedMarketplaceAmount, normalizeOrderId, rmaCashReceived } from '../utils/claimWorkflow';
import { uniqueMarketplaceRecords } from '../utils/claimSummary';
import { CompactPagination } from './CompactPagination';

type Lane = 'CS' | 'RMA';
type FinancePayment = { lane: Lane; recordId: string; amount: number; date: string; reference: string; method: string; note: string };
interface FinanceViewProps { rows: ProcessedReturnRow[]; disputes: Record<string, any>; rmaClaims: RmaClaimRecord[]; stores?: StoreProfile[]; onSavePayment: (payment: FinancePayment) => Promise<boolean>; }
type FinanceRow = { id: string; lane: Lane; orderId: string; channel: string; storeName: string; requested: number; approved: number; received: number; status: string; paymentDate?: string; paymentReference?: string; };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.max(0, Number(value) || 0));
const amount = (value: unknown) => Math.max(0, Number(value) || 0);

export const FinanceView: React.FC<FinanceViewProps> = ({ rows, disputes, rmaClaims, stores = [], onSavePayment }) => {
  const [query, setQuery] = useState('');
  const [laneFilter, setLaneFilter] = useState<'ALL' | Lane>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Belum diterima' | 'Diterima sebagian' | 'Diterima penuh' | 'Melebihi nominal disetujui'>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editing, setEditing] = useState<FinanceRow | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReference, setFormReference] = useState('');
  const [formMethod, setFormMethod] = useState('Transfer bank');
  const [formNote, setFormNote] = useState('');
  const [message, setMessage] = useState('');

  const financeRows = useMemo<FinanceRow[]>(() => {
    const orderIds = new Set(rows.map(row => normalizeOrderId(row.Order_ID)).filter(Boolean));
    const marketplaceByOrder = new Map<string, any[]>();
    uniqueMarketplaceRecords(disputes, orderIds).forEach((record: any) => {
      const orderId = normalizeOrderId(record.row.Order_ID);
      if (!orderId) return;
      const list = marketplaceByOrder.get(orderId) || [];
      list.push(record);
      marketplaceByOrder.set(orderId, list);
    });
    const marketplace = [...marketplaceByOrder.entries()].map(([orderId, records]) => {
      const first = records[0];
      const approved = amount(records.find(record => record.orderApprovedAmount !== undefined)?.orderApprovedAmount ?? records.reduce((sum, record) => sum + approvedMarketplaceAmount(record), 0));
      if (approved <= 0) return null;
      const received = records.reduce((sum, record) => sum + amount(record.financeReceivedAmount !== undefined ? record.financeReceivedAmount : record.settlementAmount), 0);
      const paymentRecord = records.find(record => record.financePaymentDate || record.financePaymentReference) || first;
      const store = stores.find(item => item.id === first.storeId);
      return { id: orderId, lane: 'CS' as const, orderId: String(first.row.Order_ID), channel: String(first.channel || 'Marketplace'), storeName: store?.name || first.storeName || 'Toko belum dipilih', requested: records.reduce((sum, record) => sum + amount(record.claimAmount), 0), approved, received, status: received > approved ? 'Melebihi nominal disetujui' : received === approved && approved > 0 ? 'Diterima penuh' : received > 0 ? 'Diterima sebagian' : 'Belum diterima', paymentDate: paymentRecord.financePaymentDate, paymentReference: paymentRecord.financePaymentReference };
    }).filter(Boolean) as FinanceRow[];
    const logistics = rmaClaims.map(claim => {
      const approved = claim.logisticsOutcome === 'REJECTED' ? 0 : amount(claim.approvedAmount ?? claim.approvedCompensation);
      if (approved <= 0) return null;
      const received = claim.financeReceivedAmount !== undefined ? amount(claim.financeReceivedAmount) : rmaCashReceived(claim);
      const store = stores.find(item => item.id === claim.storeId);
      return { id: claim.id, lane: 'RMA' as const, orderId: claim.orderId, channel: claim.logisticsName || claim.channel || 'Logistik', storeName: store?.name || claim.storeName || 'Toko belum dipilih', requested: amount(claim.estimatedCompensation), approved, received, status: received > approved ? 'Melebihi nominal disetujui' : received === approved && approved > 0 ? 'Diterima penuh' : received > 0 ? 'Diterima sebagian' : 'Belum diterima', paymentDate: claim.financePaymentDate, paymentReference: claim.financePaymentReference };
    }).filter(Boolean) as FinanceRow[];
    return [...marketplace, ...logistics];
  }, [disputes, rmaClaims, rows, stores]);

  const filtered = financeRows.filter(row => {
    if (laneFilter !== 'ALL' && row.lane !== laneFilter) return false;
    if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
    const text = `${row.orderId} ${row.channel} ${row.storeName} ${row.status}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  });
  useEffect(() => { setCurrentPage(1); }, [query, laneFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Order ID', 'Jalur', 'Toko', 'Pihak Pembayar', 'Nilai Diajukan', 'Nilai Disetujui', 'Dana Diterima', 'Sisa Belum Diterima', 'Status Pembayaran', 'Tanggal Diterima', 'Referensi'];
    const rows = filtered.map(row => [row.orderId, row.lane === 'CS' ? 'Marketplace' : 'Logistik', row.storeName, row.channel, row.requested, row.approved, row.received, Math.max(0, row.approved - row.received), row.status, row.paymentDate || '', row.paymentReference || '']);
    const csv = '\uFEFF' + [headers, ...rows].map(line => line.map(escape).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `finance-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const totals = financeRows.reduce((sum, row) => ({ approved: sum.approved + row.approved, received: sum.received + row.received, outstanding: sum.outstanding + Math.max(0, row.approved - row.received) }), { approved: 0, received: 0, outstanding: 0 });
  const openEditor = (row: FinanceRow) => { setEditing(row); setFormAmount(String(row.received)); setFormDate(row.paymentDate || new Date().toISOString().slice(0, 10)); setFormReference(row.paymentReference || ''); setFormMethod('Transfer bank'); setFormNote(''); setMessage(''); };
  const save = async () => {
    if (!editing) return;
    const numeric = Number(formAmount.replace(/[^0-9]/g, '')) || 0;
    if (!Number.isSafeInteger(numeric)) { setMessage('Nominal dana diterima tidak valid.'); return; }
    const ok = await onSavePayment({ lane: editing.lane, recordId: editing.id, amount: numeric, date: formDate, reference: formReference, method: formMethod, note: formNote });
    if (!ok) { setMessage('Gagal menyimpan pembayaran. Periksa koneksi atau izin Finance.'); return; }
    setEditing(null);
  };

  return <section className="space-y-5" aria-labelledby="finance-title">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Pusat pencatatan pembayaran</p><h1 id="finance-title" className="mt-1 text-2xl font-extrabold text-slate-900">Finance</h1><p className="mt-1 text-sm text-slate-600">Catat uang yang benar-benar diterima setelah Operation mencatat hasil banding.</p></div><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><WalletCards size={26} aria-hidden="true" /></div></div></header>
    <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-xs font-semibold text-indigo-700">Total disetujui</p><strong className="mt-1 block text-xl text-indigo-900">{money(totals.approved)}</strong></article><article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Dana diterima</p><strong className="mt-1 block text-xl text-emerald-900">{money(totals.received)}</strong></article><article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Belum diterima</p><strong className="mt-1 block text-xl text-amber-900">{money(totals.outstanding)}</strong></article></div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="relative block sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input aria-label="Cari pembayaran" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari order atau pihak pembayar…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></label><div className="relative flex flex-wrap gap-2"><button type="button" className={`warehouse-button ${laneFilter !== 'ALL' || statusFilter !== 'ALL' ? 'warehouse-button-primary' : ''}`} aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}><Filter size={15} aria-hidden="true" />Filter{laneFilter !== 'ALL' || statusFilter !== 'ALL' ? ' aktif' : ''}</button><button type="button" className="warehouse-button" onClick={exportCsv} disabled={!filtered.length}><Download size={15} aria-hidden="true" />Unduh CSV</button>{filterOpen && <div className="absolute right-0 bottom-full z-20 mb-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="Filter Finance"><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-slate-900">Filter Finance</strong><button type="button" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup filter" onClick={() => setFilterOpen(false)}><X size={16}/></button></div><label className="block text-xs font-semibold text-slate-700">Jalur<select value={laneFilter} onChange={event => setLaneFilter(event.target.value as 'ALL' | Lane)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="ALL">Semua jalur</option><option value="CS">Marketplace</option><option value="RMA">Logistik</option></select></label><label className="mt-3 block text-xs font-semibold text-slate-700">Status pembayaran<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="ALL">Semua status</option><option value="Belum diterima">Belum diterima</option><option value="Diterima sebagian">Diterima sebagian</option><option value="Diterima penuh">Diterima penuh</option><option value="Melebihi nominal disetujui">Melebihi nominal disetujui</option></select></label><button type="button" className="warehouse-button mt-3 w-full" onClick={() => { setLaneFilter('ALL'); setStatusFilter('ALL'); }}>Reset filter</button></div>}</div></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600"><tr><th className="px-4 py-3">Order / jalur</th><th className="px-4 py-3">Toko asal</th><th className="px-4 py-3">Diajukan</th><th className="px-4 py-3">Disetujui</th><th className="px-4 py-3">Diterima</th><th className="px-4 py-3">Status pembayaran</th><th className="px-4 py-3 text-right">Tindakan</th></tr></thead><tbody className="divide-y divide-slate-100">{paginated.map(row => <tr key={`${row.lane}-${row.id}`}><td className="px-4 py-3"><strong className="block font-mono text-slate-900">{row.orderId}</strong><span className={`text-xs font-semibold ${row.lane === 'CS' ? 'text-teal-700' : 'text-indigo-700'}`}>{row.lane === 'CS' ? 'Marketplace' : 'Logistik'} · {row.channel}</span></td><td className="px-4 py-3"><span className={row.storeName === 'Toko belum dipilih' ? 'text-xs font-medium text-amber-700' : 'text-sm font-semibold text-slate-800'}>{row.storeName}</span>{row.storeName === 'Toko belum dipilih' && <span className="mt-0.5 block text-xs text-slate-500">Lengkapi pada klaim</span>}</td><td className="px-4 py-3 font-mono">{money(row.requested)}</td><td className="px-4 py-3 font-mono font-bold text-indigo-800">{money(row.approved)}</td><td className="px-4 py-3 font-mono font-bold text-emerald-700">{money(row.received)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'Diterima penuh' ? 'bg-emerald-50 text-emerald-800' : row.status === 'Diterima sebagian' ? 'bg-amber-50 text-amber-800' : row.status === 'Melebihi nominal disetujui' ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{row.status}</span></td><td className="px-4 py-3 text-right"><button type="button" className="warehouse-button warehouse-button-primary" onClick={() => openEditor(row)}><Banknote size={15} aria-hidden="true" />Catat penerimaan</button></td></tr>)}{filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Belum ada hasil banding dengan nilai disetujui.</td></tr>}</tbody></table></div>
    {filtered.length > 0 && <CompactPagination page={safePage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} pageSizeOptions={[25, 50, 100]} itemLabel="baris" ariaLabel="Paginasi Finance" />}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="finance-payment-title"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 id="finance-payment-title" className="text-lg font-bold text-slate-900">Catat dana diterima</h2><p className="text-xs text-slate-500">{editing.orderId} · Nilai disetujui {money(editing.approved)}</p><p className="mt-1 text-xs font-semibold text-slate-700">Toko asal: <span className="text-indigo-700">{editing.storeName}</span></p></div><CircleDollarSign className="text-amber-600" aria-hidden="true" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Dana diterima (Rp)<input autoFocus inputMode="numeric" value={formAmount} onChange={event => setFormAmount(event.target.value.replace(/[^0-9]/g, ''))} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono" /></label>{Number(formAmount||0)>editing.approved&&<p className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-semibold text-rose-800">Nominal ini melebihi nilai disetujui dan akan ditandai untuk pemeriksaan Finance.</p>}<label className="text-sm font-semibold">Tanggal diterima<input type="date" value={formDate} onChange={event => setFormDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label><label className="text-sm font-semibold">Metode<select value={formMethod} onChange={event => setFormMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option>Transfer bank</option><option>Saldo marketplace</option><option>Potongan tagihan</option><option>Lainnya</option></select></label><label className="text-sm font-semibold sm:col-span-2">Referensi pembayaran<input value={formReference} onChange={event => setFormReference(event.target.value)} placeholder="Nomor transfer / bukti" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label><label className="text-sm font-semibold sm:col-span-2">Catatan<textarea value={formNote} onChange={event => setFormNote(event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-lg border border-slate-300 p-2.5" /></label></div>{message && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{message}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="warehouse-button" onClick={() => setEditing(null)}>Batal</button><button type="button" className="warehouse-button warehouse-button-primary" onClick={() => void save()}><Check size={15} aria-hidden="true" />Simpan penerimaan</button></div></div></div>}
  </section>;
};
