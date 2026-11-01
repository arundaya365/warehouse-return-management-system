import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, HardDrive, Info, ShieldCheck } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const LAST_BACKUP_KEY = 'unboxin_last_backup_at_v1';

const downloadResponse = async (response: Response, fallbackName: string) => {
  if (!response.ok) {
    if (response.status === 403) throw new Error('Backup hanya dapat diunduh oleh Super Admin yang sudah login.');
    throw new Error(`Backup gagal disiapkan (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const BackupSettingsView: React.FC = () => {
  const { currentUser } = useAccount();
  const localTrial = import.meta.env.VITE_LOCAL_TRIAL === 'true';
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState<'json' | 'database' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
  }, []);

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum pernah';

  const handleDownload = async (kind: 'json' | 'database') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'json') {
        await downloadResponse(await fetch('/api/local/backup/json', { credentials: 'include' }), 'unboxin-backup.json');
      } else {
        await downloadResponse(await fetch('/api/local/backup', { credentials: 'include' }), 'unboxin-database-backup.gz');
      }
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BACKUP_KEY, now);
      setLastBackup(now);
      setMessage({ type: 'success', text: kind === 'json' ? 'Snapshot data berhasil diunduh.' : 'Backup database lokal berhasil diunduh.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Backup gagal diunduh.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="backup-settings-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="rounded-xl bg-teal-50 p-3 text-teal-700"><DatabaseBackup aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Pengaturan keamanan data</p>
              <h1 id="backup-settings-title" className="mt-1 text-2xl font-extrabold text-slate-900">Backup & Pemulihan</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">Simpan salinan data retur sebelum perubahan besar atau secara rutin agar data dapat dipulihkan jika laptop bermasalah.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck size={14} aria-hidden="true" />Super Admin</span>
        </div>
      </header>

      {!localTrial ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex gap-3"><Info className="mt-0.5 shrink-0 text-indigo-600" size={18} aria-hidden="true" /><div><h2 className="font-bold text-slate-900">Backup dikelola oleh server</h2><p className="mt-1 text-sm text-slate-600">Aplikasi ini sedang menggunakan database online. Backup otomatis perlu diatur dari dashboard penyedia database, misalnya Supabase. Jangan menyimpan password database di sini.</p></div></div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-teal-900"><HardDrive size={17} aria-hidden="true" /> Snapshot data aplikasi</div>
              <p className="mt-2 text-sm text-teal-900/80">Berisi retur, klaim CS/RMA, Finance, SKU, toko, akun, dan metadata sinkronisasi dalam satu file JSON.</p>
              <button type="button" className="warehouse-button warehouse-button-primary mt-4" disabled={busy !== null} onClick={() => void handleDownload('json')}><Download size={15} aria-hidden="true" />{busy === 'json' ? 'Menyiapkan…' : 'Unduh snapshot data'}</button>
            </article>
            <article className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-900"><DatabaseBackup size={17} aria-hidden="true" /> Database lokal PostgreSQL</div>
              <p className="mt-2 text-sm text-indigo-900/80">Salinan teknis database lokal untuk pemulihan oleh admin atau teknisi. File berformat gzip.</p>
              <button type="button" className="warehouse-button mt-4" disabled={busy !== null} onClick={() => void handleDownload('database')}><Download size={15} aria-hidden="true" />{busy === 'database' ? 'Menyiapkan…' : 'Unduh database lokal'}</button>
            </article>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-900">Catatan penting</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-900/85">
              <li>• Simpan file backup ke Google Drive atau hard disk eksternal setelah diunduh.</li>
              <li>• File backup dapat memuat data akun dan data operasional sensitif. Jangan kirim lewat grup umum.</li>
              <li>• Video Google Drive tidak ikut masuk ke file database. Pastikan video tetap tersedia di Drive.</li>
              <li>• Pemulihan database dilakukan oleh Super Admin/teknisi setelah memastikan file backup yang dipilih benar.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-600">Backup terakhir: <strong className="text-slate-900">{formatDate(lastBackup)}</strong></span>
            <span className="text-xs text-slate-500">Perangkat: laptop server lokal</span>
          </div>
        </>
      )}

      {message && <div role="status" className={`rounded-xl border p-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message.type === 'success' ? <CheckCircle2 size={16} className="mr-2 inline" aria-hidden="true" /> : <AlertTriangle size={16} className="mr-2 inline" aria-hidden="true" />}{message.text}</div>}
      <p className="text-xs text-slate-500">Akun aktif: {currentUser.fullName} · Hak akses backup dibatasi untuk Super Admin.</p>
    </section>
  );
};
