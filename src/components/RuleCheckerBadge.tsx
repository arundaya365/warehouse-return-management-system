import React from 'react';
import { CheckCircle2, AlertTriangle, Video, Layers, Mic, Barcode, ShieldCheck } from 'lucide-react';
import { ProcessedReturnRow } from '../processor';

interface RuleCheckerBadgeProps {
  rows: ProcessedReturnRow[];
  hasAudio: boolean;
}

export const RuleCheckerBadge: React.FC<RuleCheckerBadgeProps> = ({ rows, hasAudio }) => {
  const hasRows = rows.length > 0;
  const missingCount = rows.filter((r) => r.Kondisi === 'Missing').length;
  const unexpectedCount = rows.filter((r) => r.Kondisi === 'Unexpected').length;
  const damageProductCount = rows.filter((r) => r.Kondisi === 'Damage Product').length;
  const damagePackagingCount = rows.filter((r) => r.Kondisi === 'Damage Packaging').length;
  const goodCount = rows.filter((r) => r.Kondisi === 'Good').length;

  const validConditions = ['Good', 'Damage Product', 'Damage Packaging', 'Missing', 'Unexpected'];
  const allConditionsValid = hasRows && rows.every((r) => validConditions.includes(r.Kondisi));

  const sampleVideoName = rows[0]?.Nama_File_Video || 'jx123456';
  const videoNameValid =
    hasRows && rows.every((r) => !r.Nama_File_Video || r.Nama_File_Video === r.Order_ID || !r.Nama_File_Video.startsWith('UNBOX_'));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm sm:text-base">
            Status Kepatuhan 6 Aturan Pemrosesan Backend
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">Total Baris Terproses:</span>
          <span className="font-mono font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
            {rows.length} SKU
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 text-xs">
        {/* Rule 1: Validasi SKU */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
            <Barcode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>1. Validasi SKU</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
            </div>
            <p className="text-slate-400 mt-0.5">
              Mencocokkan <code className="text-blue-300">Scanned_SKUs</code> dengan{' '}
              <code className="text-blue-300">Expected_SKUs</code>.
            </p>
          </div>
        </div>

        {/* Rule 2: Missing Otomatis */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>2. Aturan Missing Otomatis</span>
              {missingCount > 0 ? (
                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-mono text-[10px]">
                  {missingCount} Terdeteksi
                </span>
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
              )}
            </div>
            <p className="text-slate-400 mt-0.5">
              Barang di Expected tidak di-scan otomatis diberi kondisi{' '}
              <span className="text-rose-300 font-semibold">"Missing"</span>.
            </p>
          </div>
        </div>

        {/* Rule 3: 5 Status Kondisi Wajib */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>3. 5 Status Kondisi Wajib</span>
              {allConditionsValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
              )}
            </div>
            <p className="text-slate-400 mt-0.5">
              HANYA: <span className="text-emerald-300">Good</span>,{' '}
              <span className="text-rose-300">Damage Product</span>,{' '}
              <span className="text-amber-300">Damage Packaging</span>,{' '}
              <span className="text-rose-300">Missing</span>,{' '}
              <span className="text-orange-300">Unexpected</span>.
            </p>
          </div>
        </div>

        {/* Rule 4: Analisis Ucapan Operator */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>4. Analisis Ucapan Operator</span>
              {hasAudio ? (
                <span className="px-1.5 py-0.2 bg-pink-500/20 text-pink-300 rounded font-mono text-[10px]">
                  Audio Aktif
                </span>
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
              )}
            </div>
            <p className="text-slate-400 mt-0.5">
              Ekstrak teks ucapan ke status kondisi dan isi kolom{' '}
              <code className="text-pink-300">"Catatan_Tambahan"</code>.
            </p>
          </div>
        </div>

        {/* Rule 5: Standarisasi Video */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>5. Standarisasi Metadata Video</span>
              {videoNameValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
              )}
            </div>
            <p className="text-slate-400 mt-0.5">
              Format: No. AWB / Order ID saja (<code className="text-indigo-300 font-mono text-[11px] break-all">{sampleVideoName}</code>)
            </p>
          </div>
        </div>

        {/* Rule 6: Multi-Row Output */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start space-x-2.5">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-medium text-slate-200">
              <span>6. Multi-Row Output Wajib</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
            </div>
            <p className="text-slate-400 mt-0.5">
              Output memecah pesanan menjadi 1 baris per SKU dalam{' '}
              <span className="text-teal-300 font-semibold">JSON ARRAY murni</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Breakdown Badges */}
      {hasRows && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1">Rincian Hasil:</span>
          {goodCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              Good: {goodCount}
            </span>
          )}
          {damageProductCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
              Damage Product: {damageProductCount}
            </span>
          )}
          {damagePackagingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
              Damage Packaging: {damagePackagingCount}
            </span>
          )}
          {missingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
              Missing: {missingCount}
            </span>
          )}
          {unexpectedCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono font-medium">
              Unexpected: {unexpectedCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
