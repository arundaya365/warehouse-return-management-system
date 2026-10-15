import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  Terminal,
  Code2,
  FileCheck2,
  ArrowRight
} from 'lucide-react';

export const RulesDocs: React.FC = () => {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(false);

  const sampleCurl = `curl -X POST "https://your-domain.run.app/api/process-unboxing" \\
  -H "Content-Type: application/json" \\
  -d '{
    "Operator_ID": "OP-WH-042",
    "Order_ID": "ORD-9823441",
    "Video_Timestamp": "2026-10-07 14:20:15",
    "Link_Video": "https://drive.google.com/file/d/1vA8kL9mNpQrStUvWxYz/view",
    "audio_transcript": "Kotak headset penyok parah, baju kaos mulus, mouse layarnya retak.",
    "Expected_SKUs": [
      { "SKU_ID": "SKU-ELEC-001", "Nama_Barang": "Headset Gaming 7.1" },
      { "SKU_ID": "SKU-APPR-102", "Nama_Barang": "Kaos Distro Oversize" },
      { "SKU_ID": "SKU-ELEC-003", "Nama_Barang": "Mouse Wireless Silent" }
    ],
    "Scanned_SKUs": [
      { "SKU_ID": "SKU-ELEC-001" },
      { "SKU_ID": "SKU-APPR-102" },
      { "SKU_ID": "SKU-ELEC-003" }
    ]
  }'`;

  const outputFormatSpec = `[
  {
    "Waktu_Proses": "YYYY-MM-DD HH:MM:SS",
    "Operator_ID": "[ID Operator]",
    "Order_ID": "[Nomor Pesanan]",
    "SKU_ID": "[Barcode/ID SKU]",
    "Nama_Barang": "[Nama Master SKU]",
    "Kondisi": "[Status Kondisi]",
    "Catatan_Tambahan": "[Deskripsi jika ada]",
    "Video_Timestamp": "[Waktu mulai rekaman dari metadata]",
    "Nama_File_Video": "[Format: No. AWB / Order ID saja, misal: jx123456]",
    "Link_Video": "[URL Google Drive]"
  }
]`;

  return (
    <div className="space-y-6">
      {/* 6 Mandatory Rules Detail */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
          <ShieldAlert className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white text-base">
            Spesifikasi 6 Aturan Pemrosesan Backend Logic Processor
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-blue-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 1: Validasi SKU</span>
            </div>
            <p className="text-slate-300">
              Cocokkan daftar barang yang di-scan (<code className="text-blue-300">Scanned_SKUs</code>) dengan daftar barang pesanan (<code className="text-blue-300">Expected_SKUs</code>). Sistem merekonsiliasi identitas barang berdasarkan SKU ID atau Barcode.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-red-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 2: Missing Otomatis</span>
            </div>
            <p className="text-slate-300">
              Jika ada barang di <code className="text-red-300">Expected_SKUs</code> tetapi <strong>tidak di-scan</strong>, otomatis berikan status kondisi <span className="text-red-300 font-bold">"Missing"</span>.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-emerald-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 3: Status Kondisi Wajib</span>
            </div>
            <p className="text-slate-300">
              Gunakan <strong>HANYA</strong> salah satu dari 5 nilai berikut:
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Good</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">Damage Product</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">Damage Packaging</span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">Missing</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">Unexpected</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-pink-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 4: Analisis Ucapan (Audio Transcript)</span>
            </div>
            <p className="text-slate-300">
              Jika terdapat teks ucapan operator (<code className="text-pink-300">audio_transcript</code>), ekstrak menjadi status kondisi dan isi kolom <code className="text-pink-300">"Catatan_Tambahan"</code> secara deskriptif.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-indigo-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 5: Metadata Video & Penamaan Terstandarisasi</span>
            </div>
            <p className="text-slate-300">
              Nama file video (<code className="text-indigo-300">Nama_File_Video</code>) adalah persis <strong>No. AWB / Order ID saja tanpa tambahan apapun</strong>:
            </p>
            <div className="mt-1 font-mono text-indigo-300 bg-indigo-950/40 p-1.5 rounded border border-indigo-900/50">
              Contoh: jx123456 (sesuai Nomor Resi AWB / Order ID)
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-teal-400 mb-1 flex items-center space-x-1.5">
              <span>Aturan 6: Multi-Row Output</span>
            </div>
            <p className="text-slate-300">
              Output <strong>HARUS</strong> memecah data pesanan menjadi <strong>satu baris per SKU</strong> dalam format JSON Array murni. Tidak ada wrapping objek luar yang tidak perlu.
            </p>
          </div>
        </div>
      </div>

      {/* Format Output Wajib Specification */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">
              FORMAT OUTPUT WAJIB (JSON ARRAY murni)
            </h4>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(outputFormatSpec);
              setCopiedFormat(true);
              setTimeout(() => setCopiedFormat(false), 2000);
            }}
            className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
          >
            {copiedFormat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Salin Format</span>
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto">
          <pre>{outputFormatSpec}</pre>
        </div>
      </div>

      {/* cURL Command Testing */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">
              Integrasi REST API (cURL Terminal)
            </h4>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(sampleCurl);
              setCopiedCurl(true);
              setTimeout(() => setCopiedCurl(false), 2000);
            }}
            className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
          >
            {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Salin cURL</span>
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-blue-300 overflow-x-auto">
          <pre>{sampleCurl}</pre>
        </div>
      </div>
    </div>
  );
};
