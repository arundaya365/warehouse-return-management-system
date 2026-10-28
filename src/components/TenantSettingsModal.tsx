import React, { useState, useEffect } from 'react';
import { Building2, X, Check, RotateCcw, Palette, ShieldCheck, Tag, Info, AlertTriangle } from 'lucide-react';
import { useAccount, type TenantConfig, DEFAULT_TENANT_CONFIG } from '../context/AccountContext';
import { useLanguage } from '../context/LanguageContext';

export const TenantSettingsModal: React.FC = () => {
  const { tenantConfig, updateTenantConfig, resetTenantConfig, isTenantModalOpen, setIsTenantModalOpen, currentUser } = useAccount();
  const { isEn } = useLanguage();

  const [formData, setFormData] = useState<TenantConfig>(tenantConfig);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    if (isTenantModalOpen) {
      setFormData(tenantConfig);
    }
  }, [isTenantModalOpen, tenantConfig]);

  if (!isTenantModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantConfig(formData);
    setSaveToast(isEn ? '✓ Tenant branding settings updated!' : '✓ Pengaturan branding tenant berhasil disimpan!');
    setTimeout(() => {
      setSaveToast(null);
      setIsTenantModalOpen(false);
    }, 1200);
  };

  const handleReset = () => {
    if (window.confirm(isEn ? 'Reset tenant branding to standard default?' : 'Kembalikan pengaturan tenant ke setelan standar bawaan?')) {
      resetTenantConfig();
      setFormData(DEFAULT_TENANT_CONFIG);
      setSaveToast(isEn ? '✓ Reset to default settings' : '✓ Pengaturan dikembalikan ke setelan awal');
      setTimeout(() => setSaveToast(null), 1500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsTenantModalOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-900 via-[#0D5F58] to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-teal-200 border border-white/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isEn ? 'Tenant & Brand Customization' : 'Pengaturan Tenant & Identitas Branding'}
              </h3>
              <p className="text-xs text-teal-100/80">
                {isEn
                  ? 'Configure customer company name, logo, license & demo mode'
                  : 'Atur nama perusahaan klien, identitas lisensi, dan mode demo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTenantModalOpen(false)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isEn ? 'Close' : 'Tutup'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {saveToast && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveToast}</span>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">
                {isEn ? 'Commercial Multi-Tenant Ready' : 'Siap untuk Lisensi Komersial'}:
              </span>{' '}
              {isEn
                ? 'Changes made here will instantly reflect across the top bar, export footers, login screen, and inspection reports without altering source code.'
                : 'Perubahan nama dan logo di sini akan langsung berlaku di seluruh navbar, laporan cetak, bilah hak cipta, dan sesi operator tanpa perlu mengedit kode.'}
            </div>
          </div>

          {/* 1. Nama Perusahaan Tenant */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isEn ? 'Customer / Company Name' : 'Nama Perusahaan Pelanggan / Tenant'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="misal: PT. Tirta Kumala Sari"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs font-semibold text-slate-900 bg-white shadow-2xs transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isEn
                ? 'Displayed on top bar, official CS letters, and inspection export headers.'
                : 'Ditampilkan di navigation bar, surat sanggahan CS resmi, dan laporan inspeksi.'}
            </p>
          </div>

          {/* 2. Nama Aplikasi Produk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isEn ? 'Application / Product Name' : 'Nama Produk / Aplikasi'}
              </label>
              <input
                type="text"
                required
                value={formData.appName}
                onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                placeholder="Unboxin"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs font-semibold text-slate-900 bg-white shadow-2xs transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isEn ? 'Accent Color Theme' : 'Warna Aksen Identitas'}
              </label>
              <select
                value={formData.accentTheme}
                onChange={(e) => setFormData({ ...formData, accentTheme: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs font-semibold text-slate-900 bg-white shadow-2xs transition-all cursor-pointer"
              >
                <option value="teal">Deep Forest Teal (Standard B2B Unboxin)</option>
                <option value="emerald">Emerald Logistic Green</option>
                <option value="slate">Slate Industrial Charcoal</option>
                <option value="indigo">Royal Indigo Logistics</option>
              </select>
            </div>
          </div>

          {/* 3. Subjudul / Tagline */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isEn ? 'Operational Subtitle / Tagline' : 'Subjudul Sistem / Tagline Operasional'}
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              placeholder="Sistem Inspeksi Retur & Rekaman Video Bukti"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs font-medium text-slate-900 bg-white shadow-2xs transition-all"
            />
          </div>

          {/* 4. Hak Cipta / Footer Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isEn ? 'Copyright / License Notice' : 'Teks Hak Cipta / Lisensi Bawah'}
            </label>
            <input
              type="text"
              value={formData.copyrightText}
              onChange={(e) => setFormData({ ...formData, copyrightText: e.target.value })}
              placeholder="© 2026 Unboxin Systems. Hak Cipta Dilindungi."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs font-medium text-slate-900 bg-white shadow-2xs transition-all"
            />
          </div>

          {/* 5. Demo Data Watermark Toggle */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-bold text-amber-950">
                  {isEn ? 'Demo Data Mode' : 'Mode Data Simulasi / Demo Data'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDemoMode}
                  onChange={(e) => setFormData({ ...formData, isDemoMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
              </label>
            </div>
            <p className="text-[11px] text-amber-800">
              {isEn
                ? 'When active, sample records are clearly badged with "DEMO DATA" so clients and testers do not confuse simulated data with live production orders.'
                : 'Jika aktif, data skenario sampel ditandai dengan badge "DATA DEMO" yang mencolok agar klien maupun penguji tidak keliru mengira data simulasi sebagai retur riil.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{isEn ? 'Reset to Default' : 'Kembalikan Setelan'}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsTenantModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#0D5F58] hover:bg-[#0A4B45] rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isEn ? 'Save Changes' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
