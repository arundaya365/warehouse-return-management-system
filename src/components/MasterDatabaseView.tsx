import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Barcode,
  Tag,
  Package,
  FileDown,
  Coins
} from 'lucide-react';
import {
  MasterSKUItem,
  downloadExcelTemplate,
  downloadCsvTemplate,
  parseExcelOrCsvFile,
  DEFAULT_MASTER_DATABASE,
  saveMasterDatabase,
  formatRupiah,
  parseNumericPrice
} from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';

interface MasterDatabaseViewProps {
  masterData: MasterSKUItem[];
  setMasterData: (data: MasterSKUItem[]) => void;
  onSelectAwbForUnboxing?: (awb: string) => void;
}

export const MasterDatabaseView: React.FC<MasterDatabaseViewProps> = ({
  masterData,
  setMasterData
}) => {
  const { t, isEn } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form input manual 4 kolom (Barcode, SKU ID, SKU Name, Harga Barang)
  const [newBarcode, setNewBarcode] = useState('');
  const [newSkuId, setNewSkuId] = useState('');
  const [newSkuName, setNewSkuName] = useState('');
  const [newHarga, setNewHarga] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const parsed = await parseExcelOrCsvFile(file);
      setMasterData(parsed);
      saveMasterDatabase(parsed);
      setUploadMessage({
        type: 'success',
        text: `Berhasil mengimpor ${parsed.length} baris Master SKU dari file "${file.name}"!`
      });
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: 'Gagal mengimpor file: ' + (err instanceof Error ? err.message : String(err))
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuId.trim() || !newSkuName.trim()) {
      alert('Harap isi minimal SKU ID dan SKU NAME!');
      return;
    }

    const parsedHarga = parseNumericPrice(newHarga);

    const newItem: MasterSKUItem = {
      BARCODE: (newBarcode.trim() || newSkuId.trim()).toUpperCase(),
      SKU_ID: newSkuId.trim().toUpperCase(),
      SKU_NAME: newSkuName.trim(),
      HARGA: parsedHarga
    };

    const updated = [newItem, ...masterData];
    setMasterData(updated);
    saveMasterDatabase(updated);

    setNewBarcode('');
    setNewSkuId('');
    setNewSkuName('');
    setNewHarga('');
    setUploadMessage({
      type: 'success',
      text: `Master SKU ${newItem.SKU_ID} (${newItem.SKU_NAME}) ${newItem.HARGA ? `dengan harga ${formatRupiah(newItem.HARGA)}` : ''} berhasil ditambahkan!`
    });
  };

  const handleDeleteItem = (index: number) => {
    const updated = masterData.filter((_, i) => i !== index);
    setMasterData(updated);
    saveMasterDatabase(updated);
  };

  const handleResetToDefault = () => {
    if (confirm('Kembalikan database Master SKU ke data contoh bawaan?')) {
      setMasterData(DEFAULT_MASTER_DATABASE);
      saveMasterDatabase(DEFAULT_MASTER_DATABASE);
      setUploadMessage({
        type: 'success',
        text: 'Database Master SKU berhasil di-reset ke template standar.'
      });
    }
  };

  const filteredData = masterData.filter((item) => {
    const q = searchQuery.toLowerCase();
    const formattedPrice = item.HARGA ? formatRupiah(item.HARGA).toLowerCase() : '';
    const numericStr = item.HARGA ? String(item.HARGA) : '';
    return (
      item.BARCODE.toLowerCase().includes(q) ||
      item.SKU_ID.toLowerCase().includes(q) ||
      item.SKU_NAME.toLowerCase().includes(q) ||
      formattedPrice.includes(q) ||
      numericStr.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HEADER & FORMAT SPECIFICATION                                          */}
      {/* ========================================================================= */}
      <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-[#0F172A] text-base">
                  {t('master_title')}
                </h3>
                <span className="text-[11px] font-semibold bg-[#F0FDFA] text-[#0F766E] px-2 py-0.5 rounded-full border border-teal-200">
                  {isEn ? '4-Column Format' : 'Format 4 Kolom'}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                {isEn 
                  ? 'File columns: A • BARCODE | B • SKU ID | C • SKU NAME | D • ITEM PRICE'
                  : 'Struktur file: A • BARCODE | B • SKU ID | C • SKU NAME | D • HARGA BARANG'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Download Template & Import File */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadExcelTemplate}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#059669] hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title={isEn ? "Download Excel (.xlsx) 4-Column Template" : "Unduh format template Excel .xlsx (4 Kolom)"}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('master_download_xlsx')}</span>
            </button>

            <button
              onClick={downloadCsvTemplate}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#F0FDFA] text-[#134E4A] rounded-xl text-xs font-medium border border-[#E2E8F0] shadow-xs transition-all cursor-pointer"
              title={isEn ? "Download CSV Template" : "Unduh format template CSV (4 Kolom)"}
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('master_download_csv')}</span>
            </button>

            <label className="flex items-center space-x-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-all">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? (isEn ? 'Uploading...' : 'Mengunggah...') : t('master_import_file')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            <button
              onClick={handleResetToDefault}
              className="p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-sm"
              title={t('master_reset_default')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Upload Message Toast */}
        {uploadMessage && (
          <div
            className={`p-3 rounded-2xl border text-xs font-medium flex items-center space-x-2 animate-fade-in ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{uploadMessage.text}</span>
          </div>
        )}

        {/* 4-Column Visual Guide Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-[#0F766E] text-white font-mono font-bold text-xs flex items-center justify-center">
                A
              </span>
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                BARCODE
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Nomor barcode fisik kemasan (misal: EAN-13, barcode fisik produk).
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-teal-800 text-white font-mono font-bold text-xs flex items-center justify-center">
                B
              </span>
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                SKU ID
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Kode unik barang (misal: <code className="text-[#0F766E] font-bold">SKU-SKINCARE-01</code>).
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-[#059669] text-white font-mono font-bold text-xs flex items-center justify-center">
                C
              </span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                SKU NAME
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Nama lengkap deskripsi produk yang diinspeksi.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/70 border border-amber-200/80 shadow-sm space-y-1 bg-amber-50/30">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                D
              </span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                HARGA BARANG
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Harga satuan barang untuk perhitungan nominal klaim ganti rugi & aju banding CS.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MANUAL INPUT FORM (4 FIELDS: BARCODE, SKU ID, SKU NAME, HARGA)         */}
      {/* ========================================================================= */}
      <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
          <Plus className="w-4 h-4 text-[#0F766E]" />
          <h4 className="font-semibold text-slate-800 text-sm">
            Tambah Master SKU Manual
          </h4>
        </div>

        <form onSubmit={handleAddManual} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-3 text-xs">
          <div className="lg:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">
              A • BARCODE
            </label>
            <div className="relative">
              <input
                type="text"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value.toUpperCase())}
                placeholder="Contoh: 899100100201"
                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2.5 text-slate-800 font-mono focus:border-[#0F766E] focus:outline-none shadow-sm"
              />
              <Barcode className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">
              B • SKU ID <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={newSkuId}
                onChange={(e) => setNewSkuId(e.target.value.toUpperCase())}
                placeholder="Contoh: SKU-SKINCARE-01"
                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2.5 text-slate-800 font-mono font-bold focus:border-[#0F766E] focus:outline-none shadow-sm"
                required
              />
              <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-slate-700 font-bold mb-1">
              C • SKU NAME <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newSkuName}
              onChange={(e) => setNewSkuName(e.target.value)}
              placeholder="Contoh: Glow Radiance Serum 30ml"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 focus:border-[#0F766E] focus:outline-none shadow-sm"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
              <span>D • HARGA BARANG</span>
              <span className="text-[10px] text-slate-400 font-normal">Opsional</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={newHarga}
                onChange={(e) => setNewHarga(e.target.value)}
                placeholder="Contoh: 149.000"
                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2.5 text-slate-800 font-mono font-semibold focus:border-[#0F766E] focus:outline-none shadow-sm"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px]">
                Rp
              </span>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-9 flex justify-end pt-1">
            <button
              type="submit"
              className="py-2.5 px-5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simpan Master SKU</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 3. MASTER SKU TABLE VIEW (A: BARCODE, B: SKU ID, C: SKU NAME, D: HARGA)   */}
      {/* ========================================================================= */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <Package className="w-4 h-4 text-[#0F766E]" />
            <h4 className="font-semibold text-slate-800 text-sm">
              Daftar Master SKU ({filteredData.length} Barang)
            </h4>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Barcode / SKU ID / Nama / Harga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0F766E] focus:outline-none shadow-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3 font-mono">
                  <span className="inline-block bg-teal-100 text-teal-800 px-1 py-0.2 rounded mr-1 font-bold">A</span>
                  BARCODE
                </th>
                <th className="py-2.5 px-3 font-mono">
                  <span className="inline-block bg-teal-50 text-teal-900 border border-teal-200 px-1 py-0.2 rounded mr-1 font-bold">B</span>
                  SKU ID
                </th>
                <th className="py-2.5 px-3">
                  <span className="inline-block bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded mr-1 font-bold">C</span>
                  SKU NAME
                </th>
                <th className="py-2.5 px-3 text-right">
                  <span className="inline-block bg-amber-100 text-amber-800 px-1 py-0.2 rounded mr-1 font-bold">D</span>
                  HARGA BARANG
                </th>
                <th className="py-2.5 px-3 text-right w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white/50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    Belum ada data Master SKU yang cocok. Silakan import file Excel / CSV atau tambah manual.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F0FDFA]/60 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {item.BARCODE || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#0F766E] whitespace-nowrap">
                      {item.SKU_ID}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.SKU_NAME}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {item.HARGA !== undefined && item.HARGA !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-200">
                          {formatRupiah(item.HARGA)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus SKU ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
