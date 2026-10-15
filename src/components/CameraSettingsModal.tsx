import React from 'react';
import {
  Camera,
  Video,
  Monitor,
  Laptop,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Info,
  Check,
  ShieldCheck,
  Sparkles,
  Layers
} from 'lucide-react';

export interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string;
  onSelectCamera: (deviceId: string) => void;
  onRefreshDevices: () => Promise<void>;
  isRefreshing: boolean;
  resolution: '720p' | '1080p' | '480p';
  onChangeResolution: (res: '720p' | '1080p' | '480p') => void;
  isMirror: boolean;
  onToggleMirror: () => void;
  enableAudio: boolean;
  onToggleAudio: () => void;
  watermarkMode: 'watermark' | 'native';
  onChangeWatermarkMode: (mode: 'watermark' | 'native') => void;
  isWebcamActive: boolean;
  onReconnectWebcam: () => void;
}

export function isExternalDevice(device: MediaDeviceInfo, index: number): boolean {
  const lbl = (device.label || '').toLowerCase();
  if (
    lbl.includes('usb') ||
    lbl.includes('external') ||
    lbl.includes('c920') ||
    lbl.includes('c922') ||
    lbl.includes('obs') ||
    lbl.includes('droidcam') ||
    lbl.includes('iriun') ||
    lbl.includes('cam link') ||
    lbl.includes('logitech') ||
    lbl.includes('aukey')
  ) {
    return true;
  }
  if (
    lbl.includes('integrated') ||
    lbl.includes('internal') ||
    lbl.includes('facetime') ||
    lbl.includes('built-in') ||
    lbl.includes('front') ||
    lbl.includes('laptop') ||
    lbl.includes('bawaan')
  ) {
    return false;
  }
  // Default heuristik: kamera kedua dan seterusnya biasanya USB eksternal di PC/laptop
  return index > 0;
}

export function getCleanCameraLabel(device: MediaDeviceInfo, index: number): { title: string; subtitle: string; isExternal: boolean } {
  const isExt = isExternalDevice(device, index);
  const raw = device.label.trim();
  
  if (!raw) {
    return {
      title: isExt ? `Webcam Eksternal USB (Kamera ${index + 1})` : `Webcam Komputer / Bawaan (Kamera ${index + 1})`,
      subtitle: isExt ? 'Kamera eksternal unboxing meja' : 'Kamera internal laptop / PC',
      isExternal: isExt
    };
  }

  return {
    title: raw,
    subtitle: isExt ? 'Webcam Eksternal USB (Meja Unboxing)' : 'Webcam Komputer / Built-in Laptop',
    isExternal: isExt
  };
}

export const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({
  isOpen,
  onClose,
  availableCameras,
  selectedCameraId,
  onSelectCamera,
  onRefreshDevices,
  isRefreshing,
  resolution,
  onChangeResolution,
  isMirror,
  onToggleMirror,
  enableAudio,
  onToggleAudio,
  watermarkMode,
  onChangeWatermarkMode,
  isWebcamActive,
  onReconnectWebcam
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-[#0F766E] to-emerald-800 text-white flex items-center justify-between relative shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-200 shrink-0 shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Pengaturan Kamera & Multi-Webcam
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-400/20 text-teal-100 border border-teal-300/30">
                  {availableCameras.length} Terdeteksi
                </span>
              </div>
              <p className="text-xs text-teal-100/90 leading-tight mt-0.5">
                Kelola peralihan antara webcam komputer dan webcam eksternal USB unboxing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Tutup pengaturan kamera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-slate-800 text-xs sm:text-sm">
          {/* Section 1: Pemilihan Kamera Aktif */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Video className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Pilih Sumber Kamera (Webcam Source)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Pilih perangkat kamera yang sedang merekam meja unboxing paket retur
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRefreshDevices()}
                disabled={isRefreshing}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/60 text-slate-700 hover:text-[#0F766E] text-[11px] font-semibold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                title="Pindai ulang hardware USB kamera yang baru dicolok"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
                <span>{isRefreshing ? 'Memindai...' : 'Pindai Ulang'}</span>
              </button>
            </div>

            {availableCameras.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Kamera Fisik Belum Terdeteksi atau Belum Diizinkan</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Pastikan webcam komputer atau webcam eksternal USB sudah dicolokkan ke laptop/PC dan Anda telah menekan tombol "Izinkan Akses Kamera" pada peramban web (browser).
                </p>
                <button
                  type="button"
                  onClick={onReconnectWebcam}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Minta Izin & Hubungkan Ulang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {availableCameras.map((device, idx) => {
                  const meta = getCleanCameraLabel(device, idx);
                  const isSelected = selectedCameraId
                    ? device.deviceId === selectedCameraId
                    : idx === 0;

                  return (
                    <div
                      key={device.deviceId || `cam-${idx}`}
                      onClick={() => onSelectCamera(device.deviceId)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-[#0F766E] bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#0F766E] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {meta.isExternal ? (
                            <Camera className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {meta.title}
                            </h4>
                            {meta.isExternal ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                                Eksternal USB
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                Komputer
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {meta.subtitle} • ID: {device.deviceId ? device.deviceId.slice(0, 12) + '...' : 'Default System'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-2">
                        {isSelected ? (
                          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-teal-600 text-white text-[11px] font-bold shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCamera(device.deviceId);
                            }}
                            className="px-2.5 py-1 rounded-xl border border-slate-200 hover:border-[#0F766E] text-slate-600 hover:text-[#0F766E] text-[11px] font-semibold transition-all bg-white"
                          >
                            Gunakan Ini
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Resolusi & Kualitas Video */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Resolusi & Kualitas Perekaman Video</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeResolution('720p')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  resolution === '720p'
                    ? 'border-[#0F766E] bg-teal-50/70 text-[#0F766E] ring-2 ring-teal-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 font-medium'
                }`}
              >
                <div className="text-xs font-extrabold">HD 720p</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">1280x720 (30 FPS)</div>
                <div className="text-[9px] text-emerald-700 font-bold mt-1">★ SOP Standar Gudang</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeResolution('1080p')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  resolution === '1080p'
                    ? 'border-[#0F766E] bg-teal-50/70 text-[#0F766E] ring-2 ring-teal-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 font-medium'
                }`}
              >
                <div className="text-xs font-extrabold">Full HD 1080p</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">1920x1080 (Detail Tinggi)</div>
                <div className="text-[9px] text-slate-400 font-medium mt-1">Untuk Teks Sangat Kecil</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeResolution('480p')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  resolution === '480p'
                    ? 'border-[#0F766E] bg-teal-50/70 text-[#0F766E] ring-2 ring-teal-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 font-medium'
                }`}
              >
                <div className="text-xs font-extrabold">SD 480p</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">854x480 (Ringan)</div>
                <div className="text-[9px] text-slate-400 font-medium mt-1">Koneksi / PC Terbatas</div>
              </button>
            </div>
          </div>

          {/* Section 3: Orientasi Video Mirroring & Audio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Mirror Toggle */}
            <div
              onClick={onToggleMirror}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                isMirror
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <FlipHorizontal className="w-4 h-4 text-teal-700" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Cermin Video (Mirror)</h5>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {isMirror ? 'Aktif (Cermin horizontal)' : 'Mati (Normal / Standar teks paket)'}
                  </p>
                </div>
              </div>

              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  isMirror ? 'bg-[#0F766E]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                    isMirror ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Audio Toggle */}
            <div
              onClick={onToggleAudio}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                enableAudio
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  {enableAudio ? (
                    <Volume2 className="w-4 h-4 text-teal-700" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Audio / Suara Mic</h5>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {enableAudio ? 'Aktif (Rekam suara unboxing)' : 'Mati (Hanya video hening)'}
                  </p>
                </div>
              </div>

              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  enableAudio ? 'bg-[#0F766E]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                    enableAudio ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Mode Watermark & Pipeline Rekaman */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Mode Rendering Watermark Video Rekaman</span>
              </label>
              <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
                Anti-Lag 30 FPS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onChangeWatermarkMode('watermark')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  watermarkMode === 'watermark'
                    ? 'border-[#0F766E] bg-teal-50/70 text-[#0F766E] ring-2 ring-teal-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Watermark Bukti Resmi</span>
                  </span>
                  {watermarkMode === 'watermark' && (
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                  )}
                </div>
                <p className="text-[10px] text-slate-600 leading-tight">
                  Watermark nama gudang, jam running, dan AWB terbakar ke file video Google Drive.
                </p>
                <div className="text-[9px] text-emerald-700 font-bold mt-1.5 flex items-center space-x-1">
                  <span>★ Teroptimasi Cepat & Ringan (30 FPS)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeWatermarkMode('native')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  watermarkMode === 'native'
                    ? 'border-[#0F766E] bg-teal-50/70 text-[#0F766E] ring-2 ring-teal-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Direct Native Stream</span>
                  </span>
                  {watermarkMode === 'native' && (
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                  )}
                </div>
                <p className="text-[10px] text-slate-600 leading-tight">
                  Rekam feed kamera murni tanpa beban rendering canvas sama sekali.
                </p>
                <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex items-center space-x-1">
                  <span>Zero CPU Overhead (PC Sangat Terbatas)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section 5: Panduan Setup 2 Webcam di Gudang Retur */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-700 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
              <Info className="w-4 h-4 text-[#0F766E] shrink-0" />
              <span>SOP Posisi 2 Webcam di Stasiun Unboxing:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 leading-snug">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <span className="font-bold text-[#0F766E] block mb-0.5">🎥 Webcam Eksternal USB (Meja):</span>
                Pasang pada tiang/arm di atas meja menghadap ke bawah menyorot kardus paket, label barcode resi AWB, dan fisik produk.
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <span className="font-bold text-purple-700 block mb-0.5">💻 Webcam Komputer (Bawaan):</span>
                Menghadap operator untuk verifikasi visual, absensi operator, atau monitoring keamanan area stasiun.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Pengaturan otomatis tersimpan di peramban ini</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Selesai & Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
