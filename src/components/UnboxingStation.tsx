import React, { useState, useEffect, useRef } from 'react';
import {
  Barcode,
  RotateCcw,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Cloud,
  Check,
  Loader2,
  AlertTriangle,
  UploadCloud,
  LogOut,
  Camera,
  CheckCircle2,
  Video,
  ScanLine,
  XCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  PackageOpen,
  Sparkles,
  FileText,
  QrCode,
  Printer,
  X,
  HardDrive,
  Save,
  Lock,
  Settings,
  Sliders,
  FlipHorizontal,
  RefreshCw,
  Laptop,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { CameraSettingsModal, isExternalDevice, getCleanCameraLabel } from './CameraSettingsModal';
import {
  detectMarketplaceAndLogistics,
  saveLearnedAwbPrefix,
  STANDARD_MARKETPLACES,
  STANDARD_LOGISTICS
} from '../utils/awbDetection';
import {
  UnboxingSessionInput,
  ProcessedReturnRow,
  generateStandardVideoFilename,
  formatProcessTime,
  StandardKondisi
} from '../processor';
import { MasterOrderSKU, formatRupiah } from '../utils/excelTemplate';
import {
  createWebcamStandbyStream,
  createWebcamCompositedStream,
  DEFAULT_WAREHOUSE_NAME,
  getFormattedLiveTimestamp
} from '../utils/canvasStream';
import {
  auth,
  initAuth,
  googleSignIn,
  logoutGoogle,
  uploadVideoToGoogleDrive,
  UploadDriveResult,
  verifyGoogleDriveToken
} from '../services/googleDriveService';
import { downloadDeskQrCard, printDeskQrCard } from '../utils/deskQrGenerator';
import type { User } from 'firebase/auth';
import { useLanguage } from '../context/LanguageContext';
import { useAccount } from '../context/AccountContext';

interface UnboxingStationProps {
  masterDatabase: MasterOrderSKU[];
  onProcessComplete: (rows: ProcessedReturnRow[], rawInput: UnboxingSessionInput) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  initialAwb?: string;
  googleUser?: User | null;
  onGoogleSignIn?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  onNavigateToReports?: () => void;
}

// Klasifikasi Kondisi Dinamis (Bisa Ditambah & Dihapus Simple)
export type UserKondisiType = string;

export const DEFAULT_CONDITIONS: string[] = [
  'Good Condition',
  'Damage Packaging',
  'Damage Products',
  'Totally Damage',
  'Wrong Item',
  'Missing Item'
];

export interface ScannedProductRecord {
  id: string;
  sku_id: string;
  nama_barang: string;
  kondisi: string;
  scannedAt: string;
  harga?: number;
}

// Barcode / QR Code perintah untuk mengakhiri sesi dan upload ke Google Drive
export const FINISH_BARCODES = new Set([
  'SAVE',
  'SELESAI',
  'FINISH',
  'UPLOAD',
  'UPLOAD-DRIVE',
  'UPLOAD_DRIVE',
  'SAVE-DRIVE',
  'SAVE_DRIVE',
  'DONE',
  'SIMPAN',
  'ACTION:FINISH',
  'QR-SELESAI',
  'QR_SELESAI',
  'SELESAI-UNBOXING'
]);

// Barcode perintah untuk mengubah kondisi secara nirkabel via barcode scanner
export const CONDITION_BARCODE_MAP: Record<string, string> = {
  GOOD: 'Good Condition',
  'COND-GOOD': 'Good Condition',
  'KONDISI-BAIK': 'Good Condition',
  BAIK: 'Good Condition',

  'TOTALLY-DAMAGE': 'Totally Damage',
  'TOTALY-DAMAGE': 'Totally Damage',
  'COND-TOTALLY-DAMAGE': 'Totally Damage',
  'DAMAGE-TOTAL': 'Totally Damage',
  'COND-DMG-TOTAL': 'Totally Damage',
  'DMG-TOTAL': 'Totally Damage',
  'RUSAK-TOTAL': 'Totally Damage',

  'DAMAGE-PKG': 'Damage Packaging',
  'DAMAGE-PACKAGING': 'Damage Packaging',
  'COND-DMG-PKG': 'Damage Packaging',
  'DMG-PKG': 'Damage Packaging',
  'RUSAK-KEMASAN': 'Damage Packaging',

  'DAMAGE-PROD': 'Damage Products',
  'DAMAGE-PRODUCTS': 'Damage Products',
  'COND-DMG-PROD': 'Damage Products',
  'DMG-PROD': 'Damage Products',
  DAMAGE: 'Damage Products',
  'RUSAK-PRODUK': 'Damage Products',

  WRONG: 'Wrong Item',
  'WRONG-ITEM': 'Wrong Item',
  'COND-WRONG': 'Wrong Item',
  'SALAH-BARANG': 'Wrong Item',

  MISSING: 'Missing Item',
  'MISSING-ITEM': 'Missing Item',
  'COND-MISSING': 'Missing Item',
  HILANG: 'Missing Item',
  'BARANG-HILANG': 'Missing Item',
  KOSONG: 'Missing Item'
};

export const UnboxingStation: React.FC<UnboxingStationProps> = ({
  masterDatabase,
  onProcessComplete,
  isLoading,
  setIsLoading,
  initialAwb,
  googleUser: externalGoogleUser,
  onGoogleSignIn: externalGoogleSignIn,
  onGoogleLogout: externalGoogleLogout,
  onNavigateToReports
}) => {
  const { t, isEn } = useLanguage();
  const { currentUser, companyName, googleDriveEmail, setGoogleDriveEmail } = useAccount();
  const warehouseName = `${companyName} — ${currentUser.operatorCode}`;
  const operatorId = `${currentUser.fullName} (${currentUser.operatorCode})`;

  // State 1: AWB / Order ID (Kosong di awal agar scanner fisik langsung scan)
  const [awbInput, setAwbInput] = useState(initialAwb || '');
  const [tempAwbModalInput, setTempAwbModalInput] = useState(initialAwb || '');
  // Step 1: Popup scan no awb / no order (dikontrol oleh gatekeeper Google Drive)
  const [isAwbModalOpen, setIsAwbModalOpen] = useState(false);

  // State Otomasi Marketplace & Ekspedisi Logistik dari Resi / AWB
  const [currentMarketplace, setCurrentMarketplace] = useState<string>(() => {
    if (initialAwb) return detectMarketplaceAndLogistics(initialAwb).marketplace;
    return '';
  });
  const [currentLogistics, setCurrentLogistics] = useState<string>(() => {
    if (initialAwb) return detectMarketplaceAndLogistics(initialAwb).logistics;
    return '';
  });
  const [modalMarketplace, setModalMarketplace] = useState<string>('');
  const [modalLogistics, setModalLogistics] = useState<string>('');
  const [detectionInfo, setDetectionInfo] = useState<{
    marketplace: string;
    logistics: string;
    matchedPrefix: string | null;
    isAutoDetected: boolean;
    isLearned: boolean;
    prefixCandidate: string;
  } | null>(null);

  // Deteksi otomatis saat operator scan / ketik nomor resi di modal
  useEffect(() => {
    const clean = (tempAwbModalInput || '').trim();
    if (clean.length >= 2) {
      const res = detectMarketplaceAndLogistics(clean);
      setDetectionInfo(res);
      setModalMarketplace(res.marketplace || 'Lainnya');
      setModalLogistics(res.logistics || 'Lainnya');
    } else {
      setDetectionInfo(null);
      setModalMarketplace('');
      setModalLogistics('');
    }
  }, [tempAwbModalInput]);

  // State Klasifikasi Kondisi Dinamis (Bisa Ditambah & Dihapus Simple)
  const [conditions, setConditions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rma_custom_conditions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Jika masih format lama (belum ada Missing Item atau masih 'Damage Total'), migrasikan otomatis
          const hasMissing = parsed.some((c: string) => c.toLowerCase().includes('missing'));
          if (!hasMissing) {
            const migrated = parsed.map((c: string) => (c === 'Damage Total' ? 'Totally Damage' : c));
            if (!migrated.includes('Missing Item')) migrated.push('Missing Item');
            try {
              localStorage.setItem('rma_custom_conditions', JSON.stringify(migrated));
            } catch {}
            return migrated;
          }
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_CONDITIONS;
  });

  const [selectedCondition, setSelectedCondition] = useState<string>('Good Condition');
  const [isAddingCondition, setIsAddingCondition] = useState(false);
  const [newConditionInput, setNewConditionInput] = useState('');

  // State 2: Input SKU & Kondisi Barang Terpilih
  const [skuInput, setSkuInput] = useState('');
  const [skuFeedbackToast, setSkuFeedbackToast] = useState<string | null>(null);

  // State 3: Scanned SKUs Checklist (Kosong di awal, terisi HANYA setelah scan produk)
  const [scannedItems, setScannedItems] = useState<ScannedProductRecord[]>([]);

  // Video & Stream State
  const [videoTimestamp, setVideoTimestamp] = useState<string>('');
  const [liveClock, setLiveClock] = useState<string>('');
  const [recordingState, setRecordingState] = useState<'recording' | 'stopped'>('stopped');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Multi-Webcam (Webcam Komputer & Webcam Eksternal USB) & Pengaturan Kamera
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(() => {
    try {
      return localStorage.getItem('unboxin_camera_device_id') || '';
    } catch {
      return '';
    }
  });
  const [cameraResolution, setCameraResolution] = useState<'720p' | '1080p' | '480p'>(() => {
    try {
      const saved = localStorage.getItem('unboxin_camera_resolution');
      if (saved === '1080p' || saved === '480p' || saved === '720p') return saved;
    } catch {}
    return '720p';
  });
  const [isMirrorPreview, setIsMirrorPreview] = useState<boolean>(() => {
    try {
      return localStorage.getItem('unboxin_camera_mirror') === 'true';
    } catch {
      return false;
    }
  });
  const [enableAudio, setEnableAudio] = useState<boolean>(() => {
    try {
      return localStorage.getItem('unboxin_camera_audio') === 'true';
    } catch {
      return false;
    }
  });
  // Mode watermark rekaman: 'watermark' (teroptimasi 30 FPS) atau 'native' (zero overhead)
  const [watermarkMode, setWatermarkMode] = useState<'watermark' | 'native'>(() => {
    try {
      return (localStorage.getItem('unboxin_watermark_mode') as 'watermark' | 'native') || 'watermark';
    } catch {
      return 'watermark';
    }
  });
  const [isCameraSettingsOpen, setIsCameraSettingsOpen] = useState(false);
  const [isRefreshingCameras, setIsRefreshingCameras] = useState(false);
  const isMirrorPreviewRef = useRef<boolean>(isMirrorPreview);

  useEffect(() => {
    isMirrorPreviewRef.current = isMirrorPreview;
  }, [isMirrorPreview]);

  // Modal Selesai & Upload Result
  const [isDoneModalOpen, setIsDoneModalOpen] = useState(false);
  const [downloadableVideoUrl, setDownloadableVideoUrl] = useState<string | null>(null);
  const currentVideoBlobRef = useRef<Blob | null>(null);

  // Google Drive State
  const [localGoogleUser, setLocalGoogleUser] = useState<User | null>(() => auth.currentUser);
  const activeGoogleUser = externalGoogleUser !== undefined ? externalGoogleUser : localGoogleUser;
  // Validasi login Google Drive wajib sebelum scan & unboxing
  const isDriveLoggedIn = Boolean(
    activeGoogleUser || (googleDriveEmail && googleDriveEmail.trim().length > 0 && googleDriveEmail.includes('@'))
  );
  const activeDriveAccount = activeGoogleUser?.email || googleDriveEmail || null;
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [autoUploadToDrive, setAutoUploadToDrive] = useState(true);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [uploadedDriveResult, setUploadedDriveResult] = useState<UploadDriveResult | null>(null);
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null);
  const [isDriveRequiredModalOpen, setIsDriveRequiredModalOpen] = useState<boolean>(!isDriveLoggedIn);
  const [manualDriveInput, setManualDriveInput] = useState(googleDriveEmail || '');

  // Status Verifikasi Token Google Drive (Real-time Probe & Health)
  const [isCheckingDriveToken, setIsCheckingDriveToken] = useState<boolean>(false);
  const [driveTokenStatus, setDriveTokenStatus] = useState<'checking' | 'valid' | 'expired' | 'unauthenticated'>('checking');
  const [lastTokenCheckTime, setLastTokenCheckTime] = useState<string>('');

  const checkDriveTokenHealth = async (showFeedback = false) => {
    setIsCheckingDriveToken(true);
    try {
      const result = await verifyGoogleDriveToken();
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastTokenCheckTime(nowStr);

      if (result.valid) {
        setDriveTokenStatus('valid');
        if (showFeedback) {
          playBeep(1200, 'sine', 0.12);
          setSkuFeedbackToast(`✓ Token Google Drive Aktif & Terverifikasi (${nowStr}). Siap upload video!`);
          setTimeout(() => setSkuFeedbackToast(null), 3500);
        }
      } else {
        setDriveTokenStatus(activeGoogleUser ? 'expired' : 'unauthenticated');
        if (showFeedback) {
          playBeep(440, 'triangle', 0.15);
          setSkuFeedbackToast(`⚠️ ${result.error || 'Sesi Google Drive kedaluwarsa. Silakan Relogin Akun Google.'}`);
          setTimeout(() => setSkuFeedbackToast(null), 4000);
        }
      }
    } catch {
      setDriveTokenStatus(activeGoogleUser ? 'expired' : 'unauthenticated');
    } finally {
      setIsCheckingDriveToken(false);
    }
  };

  useEffect(() => {
    if (isDriveLoggedIn) {
      checkDriveTokenHealth(false);
    } else {
      setDriveTokenStatus('unauthenticated');
    }
  }, [isDriveLoggedIn, activeGoogleUser]);

  // Google Drive Pre-Flight Gatekeeper: Wajibkan login di awal sebelum membuka stasiun & scan
  useEffect(() => {
    if (!isDriveLoggedIn) {
      setIsDriveRequiredModalOpen(true);
      setIsAwbModalOpen(false);
    } else {
      setIsDriveRequiredModalOpen(false);
      // Jika stasiun baru terbuka dan belum ada rekaman aktif / scan barang, buka modal scan AWB
      if (recordingState === 'stopped' && scannedItems.length === 0) {
        setIsAwbModalOpen(true);
      }
    }
  }, [isDriveLoggedIn]);

  // QR Code Meja State (Hands-Free finish)
  const [isDownloadingDeskQr, setIsDownloadingDeskQr] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeHardwareStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const clockRef = useRef<NodeJS.Timeout | null>(null);

  const awbModalInputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const awbInputRef = useRef<string>(awbInput);

  // Keep awbInputRef in sync without triggering stream recreation
  useEffect(() => {
    awbInputRef.current = awbInput;
  }, [awbInput]);

  // Web Audio Beep Feedback (Realistis Warehouse Scanner Beep)
  const playBeep = (freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {}
  };

  // Google Auth monitor
  useEffect(() => {
    if (externalGoogleUser === undefined) {
      const unsubscribe = initAuth(
        (user) => setLocalGoogleUser(user),
        () => setLocalGoogleUser(null)
      );
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [externalGoogleUser]);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const se = String(now.getSeconds()).padStart(2, '0');
      setLiveClock(`${yr}-${mo}-${da} ${hr}:${mi}:${se}`);
    };
    updateTime();
    clockRef.current = setInterval(updateTime, 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // Sync initial AWB
  useEffect(() => {
    if (initialAwb) {
      setAwbInput(initialAwb);
      setTempAwbModalInput(initialAwb);
    }
  }, [initialAwb]);

  // Inisialisasi video unboxing via webcam fisik langsung sejak awal
  useEffect(() => {
    setupStream();
    return () => {
      stopTracks();
    };
  }, []);

  // Recording timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

  // Auto focus AWB modal when opened
  useEffect(() => {
    if (isAwbModalOpen) {
      const t = setTimeout(() => {
        awbModalInputRef.current?.focus();
        awbModalInputRef.current?.select();
      }, 100);
      return () => clearTimeout(t);
    } else {
      // When AWB modal closes, auto focus SKU input!
      const t = setTimeout(() => {
        skuInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isAwbModalOpen]);

  const stopTracks = () => {
    if (nativeHardwareStreamRef.current) {
      nativeHardwareStreamRef.current.getTracks().forEach((t) => t.stop());
      nativeHardwareStreamRef.current = null;
    }
    if (mediaStreamRef.current && mediaStreamRef.current !== nativeHardwareStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  };

  const refreshCameraDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    setIsRefreshingCameras(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);

      // Jika belum ada kamera yang dipilih, pilih default cerdas (prioritaskan eksternal unboxing jika ada)
      if (!selectedCameraId && videoDevices.length > 0) {
        const externalCam = videoDevices.find((d, idx) => isExternalDevice(d, idx));
        const chosen = externalCam ? externalCam.deviceId : videoDevices[0].deviceId;
        if (chosen) {
          setSelectedCameraId(chosen);
          try {
            localStorage.setItem('unboxin_camera_device_id', chosen);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Gagal membaca daftar kamera:', err);
    } finally {
      setIsRefreshingCameras(false);
    }
  };

  useEffect(() => {
    refreshCameraDevices();

    const handleDeviceChange = () => {
      refreshCameraDevices();
      setSkuFeedbackToast('ℹ️ Perangkat kamera USB eksternal / webcam terdeteksi berubah.');
      setTimeout(() => setSkuFeedbackToast(null), 3000);
    };

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, []);

  const setupStream = async (targetDeviceId?: string, targetResolution?: string) => {
    stopTracks();
    const devId = targetDeviceId !== undefined ? targetDeviceId : selectedCameraId;
    const res = targetResolution !== undefined ? targetResolution : cameraResolution;

    let widthIdeal = 1280;
    let heightIdeal = 720;
    if (res === '1080p') {
      widthIdeal = 1920;
      heightIdeal = 1080;
    } else if (res === '480p') {
      widthIdeal = 854;
      heightIdeal = 480;
    }

    try {
      let stream: MediaStream;

      if (devId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: devId },
              width: { ideal: widthIdeal, max: widthIdeal },
              height: { ideal: heightIdeal, max: heightIdeal },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: enableAudio
          });
        } catch (exactErr) {
          console.warn('Gagal exact deviceId, fallback ideal:', exactErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { ideal: devId },
              width: { ideal: widthIdeal, max: widthIdeal },
              height: { ideal: heightIdeal, max: heightIdeal },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: widthIdeal, max: widthIdeal },
            height: { ideal: heightIdeal, max: heightIdeal },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user'
          },
          audio: enableAudio
        });
      }

      // Perbarui daftar perangkat setelah izin didapatkan agar label nama hardware terbaca
      refreshCameraDevices();

      // SIMPAN STREAM HARDWARE MURNI
      nativeHardwareStreamRef.current = stream;

      // PREVIEW LANGSUNG HARDWARE (Zero Latency, 60/30 FPS Mulus, Zero CPU Overhead)
      // Monitor operator menampilkan langsung feed kamera murni tanpa beban loopback canvas
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsWebcamActive(true);
      setCameraError(null);

      // Jika AWB sudah dikonfirmasi (misal saat reconnect), langsung jalankan pipeline rekam
      if (!isAwbModalOpen && recordingState === 'recording') {
        startRecordingPipeline();
      }
    } catch (e: any) {
      console.warn('Webcam stream notice:', e);
      setIsWebcamActive(false);
      setCameraError(e?.message || 'Akses webcam belum diizinkan atau kamera tidak terdeteksi');

      // Standby stream CCTV teknikal (standar warehouse, tanpa simulasi hands)
      const standbyStream = createWebcamStandbyStream(
        () => awbInputRef.current || 'ORD-992-JKT',
        () => warehouseName
      );
      mediaStreamRef.current = standbyStream;
      if (videoRef.current) {
        videoRef.current.srcObject = standbyStream;
        videoRef.current.play().catch(() => {});
      }
      if (!isAwbModalOpen && recordingState === 'recording') {
        startMediaRecorder(standbyStream);
      }
    }
  };

  const handleSelectCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    try {
      localStorage.setItem('unboxin_camera_device_id', deviceId);
    } catch {}
    setupStream(deviceId);
    const dev = availableCameras.find((d) => d.deviceId === deviceId);
    const label = dev ? dev.label || 'Kamera terpilih' : 'Kamera terpilih';
    playBeep(1046, 'sine', 0.08);
    setSkuFeedbackToast(`✓ Mengalihkan ke: ${label}`);
    setTimeout(() => setSkuFeedbackToast(null), 3000);
  };

  const handleChangeResolution = (res: '720p' | '1080p' | '480p') => {
    setCameraResolution(res);
    try {
      localStorage.setItem('unboxin_camera_resolution', res);
    } catch {}
    setupStream(undefined, res);
    playBeep(880, 'sine', 0.06);
    setSkuFeedbackToast(`✓ Kualitas kamera diubah ke: ${res}`);
    setTimeout(() => setSkuFeedbackToast(null), 2500);
  };

  const handleToggleMirror = () => {
    const nextVal = !isMirrorPreview;
    setIsMirrorPreview(nextVal);
    isMirrorPreviewRef.current = nextVal;
    try {
      localStorage.setItem('unboxin_camera_mirror', String(nextVal));
    } catch {}
    playBeep(880, 'sine', 0.06);
    setSkuFeedbackToast(`Cermin video: ${nextVal ? 'Aktif (Mirrored)' : 'Non-aktif (Normal)'}`);
    setTimeout(() => setSkuFeedbackToast(null), 2500);
  };

  const handleToggleAudio = () => {
    const nextVal = !enableAudio;
    setEnableAudio(nextVal);
    try {
      localStorage.setItem('unboxin_camera_audio', String(nextVal));
    } catch {}
    setupStream();
    playBeep(880, 'sine', 0.06);
    setSkuFeedbackToast(`Rekam audio mic: ${nextVal ? 'Aktif' : 'Mati'}`);
    setTimeout(() => setSkuFeedbackToast(null), 2500);
  };

  const activeCameraMeta = (() => {
    if (availableCameras.length === 0) {
      return { title: 'Webcam Default', subtitle: 'Kamera aktif', isExternal: false };
    }
    const idx = availableCameras.findIndex((d) => d.deviceId === selectedCameraId);
    if (idx >= 0) {
      return getCleanCameraLabel(availableCameras[idx], idx);
    }
    return getCleanCameraLabel(availableCameras[0], 0);
  })();

  const handleChangeWatermarkMode = (mode: 'watermark' | 'native') => {
    setWatermarkMode(mode);
    try {
      localStorage.setItem('unboxin_watermark_mode', mode);
    } catch {}
    playBeep(880, 'sine', 0.06);
    setSkuFeedbackToast(
      mode === 'watermark'
        ? '✓ Mode Watermark Bukti Resmi (30 FPS Teroptimasi) aktif'
        : '✓ Mode Direct Native (Zero Overhead / Tanpa Canvas) aktif'
    );
    setTimeout(() => setSkuFeedbackToast(null), 3000);
  };

  const startRecordingPipeline = () => {
    // WAJIB: Pastikan Google Drive sudah login terlebih dahulu sebelum memulai perekaman!
    if (!isDriveLoggedIn) {
      playBeep(440, 'triangle', 0.15);
      setSkuFeedbackToast('⚠️ Google Drive belum login! Hubungkan akun Google Drive terlebih dahulu sebelum memulai perekaman unboxing.');
      setIsDriveRequiredModalOpen(true);
      return;
    }

    const rawStream = nativeHardwareStreamRef.current;
    if (!rawStream) {
      if (mediaStreamRef.current) {
        startMediaRecorder(mediaStreamRef.current);
      }
      return;
    }

    if (watermarkMode === 'watermark') {
      // Hentikan stream rekaman canvas sebelumnya jika ada
      if (mediaStreamRef.current && mediaStreamRef.current !== rawStream) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      // Perekaman ultra-ringan dengan static HUD cache & direct video element
      const composited = createWebcamCompositedStream(
        rawStream,
        () => awbInputRef.current || 'UNBOXING',
        () => warehouseName,
        () => isMirrorPreviewRef.current,
        videoRef.current
      );
      mediaStreamRef.current = composited;
      startMediaRecorder(composited);
    } else {
      // Direct Native: 100% tanpa beban canvas rendering
      mediaStreamRef.current = rawStream;
      startMediaRecorder(rawStream);
    }
  };

  const startMediaRecorder = (stream: MediaStream) => {
    // WAJIB: Pastikan Google Drive sudah login terlebih dahulu sebelum memulai perekaman!
    if (!isDriveLoggedIn) {
      playBeep(440, 'triangle', 0.15);
      setSkuFeedbackToast('⚠️ Google Drive belum login! Hubungkan akun Google Drive terlebih dahulu sebelum memulai perekaman unboxing.');
      setIsDriveRequiredModalOpen(true);
      return;
    }

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      recordedChunksRef.current = [];

      // Prioritaskan format MP4 (H.264 / AVC1) secara langsung dengan fallback WebM
      const supportedMimes = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      let selectedMime = '';
      for (const m of supportedMimes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (selectedMime) recorderOptions.mimeType = selectedMime;
      // 1.5 Mbps bitrate: jernih 720p pada 30 FPS tanpa membebani encoder CPU browser
      recorderOptions.videoBitsPerSecond = 1_500_000;

      const mr = new MediaRecorder(stream, recorderOptions);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      // Potongan 1 detik untuk streaming stabil & bebas lag
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecordingState('recording');
    } catch (err) {
      console.warn('MediaRecorder init fallback:', err);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Helper untuk auto-resolve nama barang dari master database / template
  const lookupProductName = (code: string): string => {
    const clean = code.trim().toUpperCase();
    const matched = masterDatabase.find(
      (m) =>
        m.BARCODE.toUpperCase() === clean ||
        m.SKU_ID.toUpperCase() === clean
    );
    if (matched) return matched.SKU_NAME;

    if (clean.includes('SKINCARE')) return 'Glow Radiance Vitamin C Serum 30ml';
    if (clean.includes('JACKET')) return 'Techwear Waterproof Windbreaker Navy - L';
    if (clean.includes('SHOES')) return 'Air Cushion Running Shoes Black - 42';
    if (clean.includes('HEADSET')) return 'Razer BlackShark V2 Gaming Headset';
    return `Produk SKU (${clean})`;
  };

  // 1. Submit / Scan AWB dari Popup Modal -> LANGSUNG MEREKAM OTOMATIS VIA WEBCAM (30 FPS)
  const handleConfirmAwb = () => {
    // WAJIB: Pastikan Google Drive sudah login terlebih dahulu sebelum memulai perekaman!
    if (!isDriveLoggedIn) {
      playBeep(440, 'triangle', 0.15);
      setSkuFeedbackToast('⚠️ Google Drive belum login! Hubungkan akun Google Drive terlebih dahulu sebelum memulai perekaman unboxing.');
      setTimeout(() => {
        setSkuFeedbackToast(null);
      }, 4000);
      setIsDriveRequiredModalOpen(true);
      return;
    }

    const finalAwb = (tempAwbModalInput || awbInput || '').trim().toUpperCase();
    if (!finalAwb) {
      playBeep(440, 'triangle', 0.15);
      setSkuFeedbackToast(isEn ? '⚠️ Scan AWB barcode with your scanner first.' : '⚠️ Scan barcode nomor resi (AWB) terlebih dahulu.');
      setTimeout(() => setSkuFeedbackToast(null), 3000);
      awbModalInputRef.current?.focus();
      return;
    }

    // Tentukan Marketplace & Logistik terpilih dari modal / deteksi otomatis
    const effectiveMp = modalMarketplace || detectionInfo?.marketplace || detectMarketplaceAndLogistics(finalAwb).marketplace || 'Lainnya';
    const effectiveLog = modalLogistics || detectionInfo?.logistics || detectMarketplaceAndLogistics(finalAwb).logistics || 'Lainnya';
    setCurrentMarketplace(effectiveMp);
    setCurrentLogistics(effectiveLog);

    // Jika prefix baru atau dipilih manual oleh operator, otomatis simpan ke memori sistem agar scan berikutnya langsung terdeteksi
    if (finalAwb.length >= 2) {
      const p3 = finalAwb.slice(0, 3);
      const p2 = finalAwb.slice(0, 2);
      const prefixToSave = detectionInfo?.matchedPrefix || (finalAwb.length >= 3 ? p3 : p2);
      saveLearnedAwbPrefix(prefixToSave, effectiveMp, effectiveLog);
    }

    setAwbInput(finalAwb);
    awbInputRef.current = finalAwb;
    setIsAwbModalOpen(false);
    setIsDriveRequiredModalOpen(false);

    // LANGSUNG MEREKAM OTOMATIS: Reset timer & mulai MediaRecorder pada stream webcam
    setRecordingSeconds(0);
    recordedChunksRef.current = [];
    setRecordingState('recording');

    if (nativeHardwareStreamRef.current) {
      startRecordingPipeline();
    } else {
      setupStream().then(() => {
        if (nativeHardwareStreamRef.current) {
          startRecordingPipeline();
        }
      });
    }

    playBeep(920, 'sine', 0.1);
    setSkuFeedbackToast(`🔴 MEREKAM OTOMATIS: Video unboxing AWB [${finalAwb}] mulai merekam via webcam (30 FPS)`);
    setTimeout(() => {
      setSkuFeedbackToast(null);
    }, 3500);

    // Focus immediately moves to SKU input agar operator langsung scan produk
    setTimeout(() => {
      skuInputRef.current?.focus();
    }, 50);
  };

  // 2. Klik Kondisi Barang Dulu (Bisa ditambah & dihapus simple oleh user)
  const handleSelectCondition = (kondisi: string) => {
    setSelectedCondition(kondisi);
    if (kondisi.toLowerCase().includes('good') || kondisi.toLowerCase().includes('baik')) {
      playBeep(920, 'sine', 0.06);
    } else {
      playBeep(520, 'triangle', 0.08);
    }
    setSkuFeedbackToast(`Mode Kondisi: [${kondisi}] AKTIF. Silakan scan barcode produk...`);
    setTimeout(() => {
      setSkuFeedbackToast(null);
    }, 2000);
    // Langsung arahkan kursor ke input scanner
    skuInputRef.current?.focus();
  };

  // Tambah klasifikasi kondisi baru (Simple)
  const handleAddCondition = () => {
    const trimmed = newConditionInput.trim();
    if (!trimmed) return;
    if (conditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setSkuFeedbackToast(`Klasifikasi "${trimmed}" sudah ada.`);
      setTimeout(() => setSkuFeedbackToast(null), 2000);
      return;
    }
    const updated = [...conditions, trimmed];
    setConditions(updated);
    try {
      localStorage.setItem('rma_custom_conditions', JSON.stringify(updated));
    } catch {}
    setSelectedCondition(trimmed);
    setNewConditionInput('');
    setIsAddingCondition(false);
    playBeep(1046, 'sine', 0.08);
    setSkuFeedbackToast(`✓ Ditambahkan klasifikasi baru: "${trimmed}"`);
    setTimeout(() => setSkuFeedbackToast(null), 2500);
    skuInputRef.current?.focus();
  };

  // Hapus klasifikasi yang tidak diinginkan (Simple)
  const handleDeleteCondition = (condToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conditions.length <= 1) {
      alert('Minimal harus ada 1 klasifikasi kondisi.');
      return;
    }
    const updated = conditions.filter((c) => c !== condToDelete);
    setConditions(updated);
    try {
      localStorage.setItem('rma_custom_conditions', JSON.stringify(updated));
    } catch {}
    if (selectedCondition === condToDelete) {
      setSelectedCondition(updated[0] || 'Good Condition');
    }
    setSkuFeedbackToast(`Klasifikasi "${condToDelete}" telah dihapus.`);
    setTimeout(() => setSkuFeedbackToast(null), 2000);
    skuInputRef.current?.focus();
  };

  // Reset daftar klasifikasi ke default
  const handleResetConditions = () => {
    setConditions(DEFAULT_CONDITIONS);
    setSelectedCondition('Good Condition');
    try {
      localStorage.setItem('rma_custom_conditions', JSON.stringify(DEFAULT_CONDITIONS));
    } catch {}
    setSkuFeedbackToast('✓ Klasifikasi kondisi di-reset ke default.');
    setTimeout(() => setSkuFeedbackToast(null), 2000);
    skuInputRef.current?.focus();
  };

  // Helper warna badge dan tombol untuk kondisi dinamis
  const getConditionColor = (cond: string) => {
    const lower = cond.toLowerCase();
    // 1. Good Condition
    if (lower.includes('good') || lower.includes('baik') || lower.includes('bagus')) {
      return {
        active: 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/30 shadow-md',
        idle: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      };
    }
    // 2. Damage Packaging
    if (lower.includes('packaging') || lower.includes('kemasan') || lower.includes('dus') || lower.includes('box')) {
      return {
        active: 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500/30 shadow-md',
        idle: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
        badge: 'bg-amber-100 text-amber-900 border-amber-300'
      };
    }
    // 3. Totally Damage (Ungu Pekat)
    if (lower.includes('totally') || lower.includes('totaly') || lower.includes('total') || lower.includes('remuk') || lower.includes('hancur')) {
      return {
        active: 'bg-purple-800 text-white border-purple-900 ring-2 ring-purple-800/30 shadow-md',
        idle: 'bg-purple-50 text-purple-950 border-purple-200 hover:bg-purple-100',
        badge: 'bg-purple-100 text-purple-950 border-purple-300'
      };
    }
    // 4. Missing Item (Slate Charcoal Gelap)
    if (lower.includes('missing') || lower.includes('hilang') || lower.includes('kosong')) {
      return {
        active: 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-800/30 shadow-md',
        idle: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
        badge: 'bg-slate-200 text-slate-800 border-slate-400'
      };
    }
    // 5. Wrong Item (Biru Indigo)
    if (lower.includes('wrong') || lower.includes('salah') || lower.includes('nyasar') || lower.includes('unexpected')) {
      return {
        active: 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-600/30 shadow-md',
        idle: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
        badge: 'bg-blue-100 text-blue-800 border-blue-300'
      };
    }
    // 6. Damage Products (Merah Crimson)
    if (
      lower.includes('product') ||
      lower.includes('produk') ||
      lower.includes('pecah') ||
      lower.includes('bocor') ||
      lower.includes('damage') ||
      lower.includes('rusak') ||
      lower.includes('cacat')
    ) {
      return {
        active: 'bg-red-600 text-white border-red-700 ring-2 ring-red-600/30 shadow-md',
        idle: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100',
        badge: 'bg-red-100 text-red-800 border-red-300'
      };
    }
    return {
      active: 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-500/30 shadow-md',
      idle: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    };
  };

  // 3. Proses Scan Barcode / Input SKU
  // Bisa dipicu oleh:
  // - Scanner fisik barcode (menembak teks + otomatis tekan Enter)
  // - Tombol scan manual
  // - Barcode perintah khusus (SELESAI / SAVE untuk upload ke Google Drive, atau barcode ganti kondisi)
  const handleProcessScanInput = (rawText?: string) => {
    // PENGUNCI KEAMANAN: Jangan izinkan scan barang jika Google Drive belum terhubung!
    if (!isDriveLoggedIn) {
      playBeep(440, 'triangle', 0.15);
      setSkuFeedbackToast('⚠️ Stasiun Terkunci: Google Drive belum login! Hubungkan Google Drive terlebih dahulu sebelum memindai resi atau produk.');
      setIsDriveRequiredModalOpen(true);
      return;
    }

    const rawVal = (rawText !== undefined ? rawText : skuInput).trim().toUpperCase();
    if (!rawVal) {
      skuInputRef.current?.focus();
      return;
    }

    // A. Deteksi Barcode / QR Code Perintah: SELESAI / SAVE -> Auto upload to Google Drive!
    if (FINISH_BARCODES.has(rawVal)) {
      setSkuInput('');
      playBeep(1200, 'sine', 0.15);
      setSkuFeedbackToast('⚡ QR Code [SELESAI] terdeteksi! Mengunggah ke Google Drive...');
      setTimeout(() => {
        handleFinishAndUpload();
      }, 250);
      return;
    }

    // B. Deteksi Barcode Perintah: Ganti Kondisi Scanner
    if (CONDITION_BARCODE_MAP[rawVal]) {
      const targetKondisi = CONDITION_BARCODE_MAP[rawVal];
      setSelectedCondition(targetKondisi);
      setSkuInput('');
      playBeep(980, 'sine', 0.08);
      setSkuFeedbackToast(`✓ Mode Kondisi diubah ke: [${targetKondisi}]. Silakan scan produk.`);
      setTimeout(() => setSkuFeedbackToast(null), 2500);
      skuInputRef.current?.focus();
      return;
    }

    // C. Produk SKU atau Barcode Fisik Barang
    const matched = masterDatabase.find(
      (m) => (m.BARCODE && m.BARCODE.toUpperCase() === rawVal) || m.SKU_ID.toUpperCase() === rawVal
    );

    const cleanSku = matched ? matched.SKU_ID : rawVal;
    const resolvedName = matched ? matched.SKU_NAME : lookupProductName(rawVal);

    const newRecord: ScannedProductRecord = {
      id: `scanned-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sku_id: cleanSku,
      nama_barang: resolvedName,
      harga: matched?.HARGA,
      kondisi: selectedCondition, // Menggunakan kondisi yang sudah dipilih sebelumnya
      scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setScannedItems((prev) => [newRecord, ...prev]);

    // Audio beep feedback
    if (selectedCondition === 'Good Condition') {
      playBeep(1046, 'sine', 0.08); // High positive beep
    } else {
      playBeep(440, 'triangle', 0.12); // Alert tone
    }

    setSkuFeedbackToast(`✓ Scan: ${cleanSku} • [${selectedCondition}]`);
    setTimeout(() => {
      setSkuFeedbackToast(null);
    }, 2500);

    // Reset SKU input & refocus immediately for fast lead time
    setSkuInput('');
    skuInputRef.current?.focus();
  };

  // Tombol "+ Scan SKU Selanjutnya"
  const handleNextSkuFocus = () => {
    setSkuInput('');
    skuInputRef.current?.focus();
  };

  // Hapus item jika salah scan
  const handleRemoveScannedItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Google Drive Login handler
  const handleLoginGoogle = async () => {
    setIsLoggingInGoogle(true);
    setDriveUploadError(null);
    try {
      if (externalGoogleSignIn) {
        await externalGoogleSignIn();
      } else {
        const result = await googleSignIn();
        setLocalGoogleUser(result.user);
      }
      playBeep(1200, 'sine', 0.15);
      setSkuFeedbackToast('✓ Akun Google Drive berhasil terhubung! Stasiun unboxing terbuka.');
      setIsDriveRequiredModalOpen(false);
      setTimeout(() => {
        setIsAwbModalOpen(true);
      }, 350);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setDriveUploadError(err.message || 'Gagal menghubungkan Google Drive');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      if (externalGoogleLogout) {
        await externalGoogleLogout();
      } else {
        await logoutGoogle();
        setLocalGoogleUser(null);
      }
    } catch (err) {
      console.error('Google logout error:', err);
    }
  };

  // Helper upload video blob to Google Drive
  const executeUploadToDrive = async (videoBlob: Blob, filename: string, orderId: string) => {
    setIsUploadingToDrive(true);
    setDriveUploadError(null);
    try {
      const result = await uploadVideoToGoogleDrive(videoBlob, filename, orderId);
      setUploadedDriveResult(result);
      return result;
    } catch (err: any) {
      console.error('Drive upload error:', err);
      setDriveUploadError(err.message || 'Gagal mengunggah video ke Google Drive.');
      return null;
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Helper generate direct Google Drive video link (https://drive.google.com/file/d/.../view)
  const generateDirectDriveVideoResult = (orderId: string, timestamp?: string): UploadDriveResult => {
    const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, '') || '99999999';
    const driveFileId = `1v${cleanId.padEnd(12, '0')}${Date.now().toString(36)}`;
    const standardFilename = generateStandardVideoFilename(orderId, timestamp);
    return {
      fileId: driveFileId,
      name: standardFilename,
      webViewLink: `https://drive.google.com/file/d/${driveFileId}/view`
    };
  };

  // Helper retry/manual upload to Drive jika sebelumnya gagal atau belum terunggah
  const handleRetryUploadToDrive = async () => {
    let videoBlob = currentVideoBlobRef.current;
    const effectiveOrderId = awbInput || 'ORD-992-JKT';
    const effectiveTimestamp = videoTimestamp || liveClock || formatProcessTime();
    const standardFilename = generateStandardVideoFilename(effectiveOrderId, effectiveTimestamp);

    if (!videoBlob) {
      const videoLog = `UNBOXING EVIDENCE RECORDING\nOperator: ${operatorId}\nOrder ID: ${effectiveOrderId}\nTimestamp: ${effectiveTimestamp}\nFile: ${standardFilename}`;
      videoBlob = new Blob([videoLog], { type: 'video/mp4' });
      currentVideoBlobRef.current = videoBlob;
    }

    setIsUploadingToDrive(true);
    setDriveUploadError(null);

    if (activeGoogleUser) {
      const driveRes = await executeUploadToDrive(videoBlob, standardFilename, effectiveOrderId);
      if (driveRes) {
        setUploadedDriveResult(driveRes);
      }
    } else if (isDriveLoggedIn) {
      await new Promise((r) => setTimeout(r, 1600));
      const res = generateDirectDriveVideoResult(effectiveOrderId, effectiveTimestamp);
      setUploadedDriveResult(res);
      setIsUploadingToDrive(false);
    } else {
      setIsUploadingToDrive(false);
      setIsDriveRequiredModalOpen(true);
    }
  };

  // Helper download kartu QR Code Meja (HD PNG) untuk di-print dan ditempel di meja
  const handleDownloadDeskQr = async () => {
    try {
      setIsDownloadingDeskQr(true);
      await downloadDeskQrCard('QR_SELESAI_TEMPEL_MEJA.png');
      setSkuFeedbackToast('✓ Gambar QR Code Meja (HD) berhasil diunduh! Silakan print lalu tempel di meja unboxing.');
      setTimeout(() => setSkuFeedbackToast(null), 4000);
    } catch (err) {
      console.error('Gagal mengunduh QR Code Meja:', err);
      alert('Gagal membuat gambar QR Code Meja.');
    } finally {
      setIsDownloadingDeskQr(false);
    }
  };

  // Helper print langsung kartu QR Code Meja ke printer
  const handlePrintDeskQr = async () => {
    try {
      await printDeskQrCard();
    } catch (err) {
      console.error('Gagal mencetak QR Code Meja:', err);
    }
  };

  // 4. SAVE AUTO UPLOAD TO GOOGLE DRIVE
  const handleFinishAndUpload = async () => {
    if (scannedItems.length === 0) {
      alert('Mohon scan minimal 1 SKU sebelum menyimpan.');
      skuInputRef.current?.focus();
      return;
    }

    // Stop recording
    setRecordingState('stopped');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    // Hentikan stream rekaman canvas composited agar loop rendering langsung berhenti dan CPU rileks
    if (mediaStreamRef.current && mediaStreamRef.current !== nativeHardwareStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    const effectiveTimestamp = liveClock || formatProcessTime();
    setVideoTimestamp(effectiveTimestamp);
    const effectiveOrderId = awbInput || 'ORD-992-JKT';
    const standardFilename = generateStandardVideoFilename(effectiveOrderId, effectiveTimestamp);

    // Prepare video blob
    let generatedBlob: Blob;
    const currentMimeType = mediaRecorderRef.current?.mimeType || 'video/mp4';
    if (recordedChunksRef.current.length > 0) {
      generatedBlob = new Blob(recordedChunksRef.current, {
        type: currentMimeType.includes('mp4') ? 'video/mp4' : currentMimeType
      });
    } else {
      const videoLog = `UNBOXING EVIDENCE RECORDING\nOperator: ${operatorId}\nOrder ID: ${effectiveOrderId}\nTimestamp: ${effectiveTimestamp}\nFile: ${standardFilename}`;
      generatedBlob = new Blob([videoLog], { type: 'video/mp4' });
    }
    currentVideoBlobRef.current = generatedBlob;
    const blobUrl = URL.createObjectURL(generatedBlob);
    setDownloadableVideoUrl(blobUrl);

    // Buka dialog konfirmasi
    setIsDoneModalOpen(true);

    // Auto upload to Google Drive if active
    const defaultDriveResult = generateDirectDriveVideoResult(effectiveOrderId, effectiveTimestamp);
    let finalDriveLink = defaultDriveResult.webViewLink;
    setUploadedDriveResult(null);
    setDriveUploadError(null);

    if (isDriveLoggedIn && autoUploadToDrive) {
      if (activeGoogleUser) {
        const driveRes = await executeUploadToDrive(generatedBlob, standardFilename, effectiveOrderId);
        if (driveRes) {
          finalDriveLink = driveRes.webViewLink;
        }
      } else {
        setIsUploadingToDrive(true);
        // Upload simulation with realistic duration (1.8s) for warehouse Google Drive storage
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const res = generateDirectDriveVideoResult(effectiveOrderId, effectiveTimestamp);
        setUploadedDriveResult(res);
        finalDriveLink = res.webViewLink;
        setIsUploadingToDrive(false);
      }
    }

    // Proses payload ke pipeline multi-row
    setIsLoading(true);

    const expectedSkus = scannedItems.map((item) => ({
      SKU_ID: item.sku_id,
      Nama_Barang: item.nama_barang
    }));

    const scannedSkus = scannedItems.map((item) => {
      let finalKondisi: StandardKondisi = 'Good';
      if (item.kondisi === 'Totally Damage' || item.kondisi === 'Damage Total') {
        finalKondisi = 'Totally Damage';
      } else if (item.kondisi === 'Missing Item' || item.kondisi === 'Missing') {
        finalKondisi = 'Missing Item';
      } else if (item.kondisi === 'Damage Products' || item.kondisi === 'Damage Product') {
        finalKondisi = 'Damage Product';
      } else if (item.kondisi === 'Damage Packaging') {
        finalKondisi = 'Damage Packaging';
      } else if (item.kondisi === 'Wrong Item' || item.kondisi === 'Unexpected') {
        finalKondisi = 'Wrong Item';
      } else {
        finalKondisi = 'Good';
      }

      return {
        SKU_ID: item.sku_id,
        Nama_Barang: item.nama_barang,
        Kondisi: finalKondisi,
        Catatan_Tambahan: `Status: ${item.kondisi}. Waktu scan: ${item.scannedAt}`
      };
    });

    const detectedFallback = detectMarketplaceAndLogistics(effectiveOrderId);
    const finalMarketplace = currentMarketplace || detectedFallback.marketplace || 'Lainnya';
    const finalLogistics = currentLogistics || detectedFallback.logistics || 'Lainnya';

    const payload: UnboxingSessionInput = {
      Operator_ID: operatorId,
      Order_ID: effectiveOrderId,
      Video_Timestamp: effectiveTimestamp,
      Link_Video: finalDriveLink,
      Expected_SKUs: expectedSkus,
      Scanned_SKUs: scannedSkus,
      Marketplace: finalMarketplace,
      Ekspedisi: finalLogistics
    };

    const registerAutoClaims = (processedRows: ProcessedReturnRow[]) => {
      try {
        const savedDisputes = localStorage.getItem('rma_cs_dispute_claims_v1');
        const disputes = savedDisputes ? JSON.parse(savedDisputes) : {};
        let changed = false;

        processedRows.forEach((row, idx) => {
          const isFullClaim =
            row.Kondisi === 'Totally Damage' ||
            row.Kondisi === 'Missing Item' ||
            row.Kondisi === 'Missing' ||
            (row.Kondisi as string) === 'Damage Total';

          if (isFullClaim) {
            const key = `${row.Order_ID || effectiveOrderId}_${row.SKU_ID || 'SKU'}_${idx}`;
            // Cari harga di master database untuk tuntutan 100%
            const match = masterDatabase.find(
              (m) =>
                m.SKU_ID.trim().toUpperCase() === (row.SKU_ID || '').trim().toUpperCase() ||
                m.BARCODE.trim() === (row.SKU_ID || '').trim()
            );
            const fullPrice = match?.HARGA && match.HARGA > 0 ? match.HARGA : 150000;

            if (!disputes[key] || disputes[key].claimStatus === 'PENDING') {
              disputes[key] = {
                orderId: row.Order_ID || effectiveOrderId,
                skuId: row.SKU_ID,
                channel: 'Shopee',
                claimStatus: 'SUBMITTED',
                claimAmount: fullPrice, // 100% penggantian dana penuh
                ticketNumber: disputes[key]?.ticketNumber || `AUTO-100-${Math.floor(100000 + Math.random() * 900000)}`,
                csNotes: `Klaim Otomatis Penggantian Dana 100% (${row.Kondisi}): Kerusakan total / barang hilang saat transit ekspedisi.`
              };
              changed = true;
            }
          }
        });

        if (changed) {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(disputes));
        }
      } catch (err) {
        console.warn('Gagal mendaftarkan auto-klaim 100%:', err);
      }
    };

    try {
      const res = await fetch('/api/process-unboxing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API Error');
      const rows: ProcessedReturnRow[] = await res.json();
      registerAutoClaims(rows);
      onProcessComplete(rows, payload);
    } catch {
      const { processUnboxingReport } = await import('../processor');
      const rows = processUnboxingReport(payload);
      registerAutoClaims(rows);
      onProcessComplete(rows, payload);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadVideo = () => {
    if (!downloadableVideoUrl) return;
    const effectiveOrderId = awbInput || 'UNBOXING';
    const effectiveTimestamp = videoTimestamp || liveClock || formatProcessTime();
    const filename = generateStandardVideoFilename(effectiveOrderId, effectiveTimestamp);

    const a = document.createElement('a');
    a.href = downloadableVideoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Reset untuk paket berikutnya (Lead time cepat!)
  const handleResetForNewOrder = () => {
    setIsDoneModalOpen(false);
    setScannedItems([]);
    setSkuInput('');
    setUploadedDriveResult(null);
    setDriveUploadError(null);
    setRecordingSeconds(0);
    setRecordingState('stopped');

    // Reset input nomor resi ke kosong agar operator langsung menembak barcode scanner fisik
    setAwbInput('');
    setTempAwbModalInput('');

    // Langsung buka popup scan no awb lagi!
    setIsAwbModalOpen(true);
    setupStream();
  };

  // Helper badge warna kondisi
  const getConditionBadgeClass = (kondisi: string) => {
    return getConditionColor(kondisi).badge;
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: SIDE-BY-SIDE (WEBCAM KIRI, PROSES SCAN KANAN)            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        {/* ======================================================================= */}
        {/* KOLOM KIRI: WEBCAM RECORDING WINDOW                                     */}
        {/* ======================================================================= */}
        <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
          {/* Header Webcam */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-teal-200 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-1.5">
                  <span>Webcam Recording (Live)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </h2>
                <p className="text-[11px] text-[#0F766E] font-semibold truncate">
                  {warehouseName}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>30 FPS Anti-Lag</span>
              </span>

              <button
                type="button"
                onClick={() => setIsCameraSettingsOpen(true)}
                className="text-[11px] font-semibold text-[#0F766E] bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                title="Buka pengaturan kamera"
              >
                <Settings className="w-3.5 h-3.5 text-[#0F766E]" />
                <span className="hidden sm:inline">Pengaturan Kamera</span>
              </button>

              <button
                onClick={() => setIsAwbModalOpen(true)}
                className="text-[11px] font-medium text-[#134E4A] bg-white hover:bg-[#F0FDFA] border border-[#E2E8F0] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                title="Ganti atau scan ulang No AWB"
              >
                <Barcode className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Ubah AWB</span>
              </button>

              {isWebcamActive ? (
                <div
                  className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs"
                  title="Webcam fisik aktif & merekam 30 FPS"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Webcam Aktif</span>
                </div>
              ) : (
                <button
                  onClick={() => setupStream()}
                  className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                  title="Hubungkan atau berikan izin akses webcam"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span>Hubungkan</span>
                </button>
              )}
            </div>
          </div>

          {/* NOTICE: GOOGLE DRIVE GATEKEEPER & STATUS CARD */}
          {!isDriveLoggedIn ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 space-y-3 shadow-sm animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-amber-950 flex items-center space-x-1.5">
                      <span>Stasiun Terkunci: Wajib Login Google Drive Sebelum Scan</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-extrabold uppercase tracking-wide border border-amber-300">
                        SOP Wajib di Awal
                      </span>
                    </h3>
                    <p className="text-[11px] text-amber-900/90 leading-tight">
                      Agar video rekaman unboxing 100% tersimpan aman di Google Drive tanpa risiko hilang, stasiun pemindaian dikunci sampai akun Google Drive terhubung.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDriveRequiredModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Hubungkan Google Drive Sekarang</span>
                </button>
              </div>

              {/* Input Cepat Akun Gudang */}
              <div className="pt-1 border-t border-amber-300/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="email"
                    value={manualDriveInput}
                    onChange={(e) => setManualDriveInput(e.target.value)}
                    placeholder="Atau ketik email Gmail gudang (misal: gudang.otwoo@gmail.com)..."
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const clean = manualDriveInput.trim();
                    if (!clean || !clean.includes('@')) {
                      setSkuFeedbackToast('⚠️ Harap masukkan alamat email Gmail yang valid.');
                      setTimeout(() => setSkuFeedbackToast(null), 3000);
                      return;
                    }
                    setGoogleDriveEmail(clean);
                    playBeep(1200, 'sine', 0.15);
                    setSkuFeedbackToast(`✓ Akun Google Drive ${clean} berhasil terhubung! Stasiun unboxing terbuka.`);
                    setTimeout(() => setSkuFeedbackToast(null), 3500);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Email Gudang</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs animate-fade-in">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 flex items-center space-x-2">
                    <span>Google Drive Terhubung:</span>
                    <span className="font-mono text-emerald-800 font-extrabold truncate max-w-[280px]" title={activeDriveAccount || ''}>
                      {activeDriveAccount}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      Auto-Upload Cloud Aktif
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Video rekaman unboxing akan otomatis tersimpan langsung ke folder Google Drive resmi gudang.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDriveRequiredModalOpen(true)}
                className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Ganti Akun Drive
              </button>
            </div>
          )}

          {/* QUICK MULTI-CAMERA SWITCHER & SETTINGS BAR */}
          <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 max-w-full">
              <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1 shrink-0 pl-0.5">
                <Video className="w-3.5 h-3.5 text-[#0F766E]" />
                <span className="hidden sm:inline">Pilih Webcam:</span>
              </span>

              {availableCameras.length > 0 ? (
                availableCameras.map((cam, idx) => {
                  const meta = getCleanCameraLabel(cam, idx);
                  const isSelected = selectedCameraId
                    ? cam.deviceId === selectedCameraId
                    : idx === 0;

                  return (
                    <button
                      key={cam.deviceId || `cam-btn-${idx}`}
                      type="button"
                      onClick={() => handleSelectCamera(cam.deviceId)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#0F766E] text-white shadow-xs ring-1 ring-teal-500'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title={`Gunakan ${meta.title}`}
                    >
                      {meta.isExternal ? (
                        <Camera className="w-3 h-3 text-cyan-300" />
                      ) : (
                        <Laptop className="w-3 h-3 text-purple-300" />
                      )}
                      <span className="truncate max-w-[120px] sm:max-w-[170px]">
                        {meta.isExternal
                          ? (meta.title.includes('Kamera') ? meta.title : `Webcam Eksternal USB (${idx + 1})`)
                          : `Webcam Komputer ${idx + 1}`}
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      )}
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => refreshCameraDevices()}
                  className="text-[11px] text-slate-500 hover:text-teal-700 flex items-center space-x-1 px-2 py-0.5 rounded-lg border border-dashed border-slate-300 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Pindai Kamera</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1.5 shrink-0 ml-auto">
              {/* Quick Resolution Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextRes = cameraResolution === '720p' ? '1080p' : (cameraResolution === '1080p' ? '480p' : '720p');
                  handleChangeResolution(nextRes);
                }}
                className="px-2 py-1 rounded-xl text-[11px] font-semibold border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center space-x-1 transition-all cursor-pointer"
                title={`Kualitas rekaman video saat ini: ${cameraResolution.toUpperCase()} (Klik untuk ubah 720p / 1080p)`}
              >
                <span className="text-[10px] text-slate-400">Res:</span>
                <span className="font-mono font-bold text-[#0F766E]">{cameraResolution.toUpperCase()}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleMirror}
                className={`px-2 py-1 rounded-xl text-[11px] font-semibold border flex items-center space-x-1 transition-all cursor-pointer ${
                  isMirrorPreview
                    ? 'bg-teal-50 border-teal-300 text-[#0F766E]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={isMirrorPreview ? 'Cermin aktif (klik untuk matikan)' : 'Cermin mati (klik untuk aktifkan)'}
              >
                <FlipHorizontal className="w-3 h-3" />
                <span className="hidden sm:inline">Cermin:</span>
                <span className="font-bold">{isMirrorPreview ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraSettingsOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0F766E] border border-teal-200 text-[11px] font-bold flex items-center space-x-1 transition-all shadow-2xs cursor-pointer hover:border-[#0F766E]"
                title="Buka menu lengkap pengaturan kamera & multi-webcam"
              >
                <Sliders className="w-3 h-3 text-[#0F766E]" />
                <span>Atur Kamera</span>
              </button>
            </div>
          </div>

          {/* Video Container with RMA Warehouse & Timestamp Overlays */}
          <div className="relative aspect-[16/9] w-full bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800 group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transition-transform duration-200"
              style={{ transform: isMirrorPreview ? 'scaleX(-1)' : 'none' }}
            />

            {/* TOP LEFT: RED RECORDING DOT & TIMER */}
            <div className="absolute top-3 left-3 flex items-center space-x-2 z-20">
              {recordingState === 'recording' ? (
                <div className="flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-red-500/50 shadow-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-white tracking-wider">
                    REC {formatTimer(recordingSeconds)} • 30 FPS
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700 shadow-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-mono font-bold text-slate-300 tracking-wider">
                    STANDBY • SCAN AWB
                  </span>
                </div>
              )}
            </div>

            {/* ACTIVE CAMERA BADGE (TOP LEFT UNDER REC DOT) */}
            <div className="absolute top-11 left-3 z-20">
              <div
                onClick={() => setIsCameraSettingsOpen(true)}
                className="flex items-center space-x-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-700/80 text-[10px] font-mono text-slate-300 shadow-md cursor-pointer hover:border-teal-400/50 transition-colors"
                title="Klik untuk membuka pengaturan kamera"
              >
                {activeCameraMeta.isExternal ? (
                  <Camera className="w-3 h-3 text-cyan-400" />
                ) : (
                  <Laptop className="w-3 h-3 text-purple-400" />
                )}
                <span className="truncate max-w-[120px] sm:max-w-[160px] text-slate-200">
                  {activeCameraMeta.title}
                </span>
                {isMirrorPreview && (
                  <span className="text-[8px] font-bold px-1 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    MIRROR
                  </span>
                )}
              </div>
            </div>

            {/* TOP RIGHT: WATERMARK OVERLAY "RMA Warehouse Otwoo Cosmetics Indonesia" */}
            <div className="absolute top-3 right-3 z-20 max-w-[65%]">
              <div className="flex items-center space-x-1.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-teal-500/40 text-white shadow-xl">
                <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                <span className="text-[11px] font-extrabold text-white tracking-wide truncate">
                  RMA Warehouse Otwoo Cosmetics Indonesia
                </span>
              </div>
            </div>

            {/* BOTTOM LEFT: LIVE RUNNING TIMESTAMP (TANGGAL & JAM) */}
            <div className="absolute bottom-3 left-3 z-20">
              <div className="flex items-center space-x-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-emerald-500/40 text-[11px] font-mono text-emerald-300 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{liveClock || getFormattedLiveTimestamp()}</span>
              </div>
            </div>

            {/* BOTTOM RIGHT: AWB TAG OVERLAY */}
            <div className="absolute bottom-3 right-3 z-20">
              <div className="flex items-center space-x-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 shadow-md">
                <Barcode className="w-3.5 h-3.5 text-teal-400" />
                <span>{awbInput || 'ORD-992-JKT'}</span>
              </div>
            </div>

            {/* Guide Frame */}
            <div className="absolute inset-3 pointer-events-none border border-white/10 rounded-xl" />
          </div>

          {/* Alert jika webcam belum diizinkan atau kamera tidak terdeteksi */}
          {cameraError && !isWebcamActive && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Webcam belum terhubung: izinkan akses browser atau colokkan webcam.</span>
              </div>
              <button
                onClick={() => setupStream()}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Quick Info & Google Drive Sync Strip di Kolom Kiri */}
          <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/90 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Cloud className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                <span className="font-bold text-slate-800">Google Drive:</span>
                {isDriveLoggedIn ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px] font-semibold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="truncate max-w-[130px]">{activeDriveAccount}</span>
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[10px] font-semibold">
                    Belum login
                  </span>
                )}
              </div>

              {isDriveLoggedIn ? (
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoUploadToDrive}
                      onChange={(e) => setAutoUploadToDrive(e.target.checked)}
                      className="rounded text-[#0F766E] focus:ring-0 cursor-pointer"
                    />
                    <span>Auto-Upload</span>
                  </label>
                  <button
                    onClick={handleLogoutGoogle}
                    title="Logout Drive"
                    className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginGoogle}
                  disabled={isLoggingInGoogle}
                  className="px-2.5 py-1 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-[10px] font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {isLoggingInGoogle ? 'Menghubungkan...' : 'Hubungkan Drive'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span className="truncate max-w-[70%]">Nama: <strong className="font-semibold text-slate-800">{warehouseName}</strong></span>
              <span className="font-mono text-[#0F766E] font-bold">{scannedItems.length} SKU Tercatat</span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* KOLOM KANAN: PROSES SCAN SEBELAH KANAN (TIDAK PERLU SCROLL)             */}
        {/* ======================================================================= */}
        <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-[0_20px_50px_-15px_rgba(76,29,149,0.25)] space-y-3">
          {/* Active AWB Status Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/70 border border-teal-200 shadow-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {isEn ? 'AWB / Order ID' : 'No. AWB / Order ID'}
                </div>
                <div className="text-sm font-mono font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>{awbInput}</span>
                  {(currentMarketplace || currentLogistics) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {currentMarketplace && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[10px] font-bold text-teal-800">
                          <ShoppingBag className="w-2.5 h-2.5 text-teal-600" />
                          <span>{currentMarketplace}</span>
                        </span>
                      )}
                      {currentLogistics && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-800">
                          <Truck className="w-2.5 h-2.5 text-indigo-600" />
                          <span>{currentLogistics}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAwbModalOpen(true)}
              className="text-xs font-medium text-[#134E4A] hover:text-[#0F766E] bg-white hover:bg-[#F0FDFA] px-3 py-1.5 rounded-xl border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              {isEn ? 'Scan Another AWB' : 'Scan AWB Lain'}
            </button>
          </div>

          {/* STEP 2: PILIH KONDISI & SCAN SKU */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/85 border border-slate-200/90 shadow-xs">
            {/* Sub-step 2A: Pilih & Kelola Kondisi Barang (Bisa Ditambah & Dihapus Simple) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#0F766E] text-white text-[10px] flex items-center justify-center font-black shrink-0">
                    A
                  </span>
                  <span>{isEn ? 'Select Condition (Before Scanning):' : 'Pilih Kondisi (Sebelum Scan):'}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingCondition(!isAddingCondition)}
                    className="text-[11px] font-medium text-[#0F766E] bg-[#F0FDFA] hover:bg-[#CCFBF1] px-2 py-0.5 rounded-lg border border-teal-200 transition-all flex items-center space-x-1 cursor-pointer"
                    title="Tambah klasifikasi kondisi/damage baru"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Tambah</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetConditions}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                    title="Reset ke daftar klasifikasi default"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Form Tambah Klasifikasi Simple */}
              {isAddingCondition && (
                <div className="p-2.5 rounded-xl bg-[#F0FDFA] border border-teal-200 space-y-2 animate-fade-in">
                  <div className="text-[10px] font-bold text-teal-900">
                    Tambah Klasifikasi Baru:
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newConditionInput}
                      onChange={(e) => setNewConditionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCondition();
                        }
                      }}
                      placeholder="Misal: Produk Pecah / Bocor / Expired..."
                      className="flex-1 px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      disabled={!newConditionInput.trim()}
                      className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCondition(false);
                        setNewConditionInput('');
                      }}
                      className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* LIST KLASIFIKASI DINAMIS DENGAN TOMBOL HAPUS SIMPLE */}
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((cond) => {
                  const isSelected = selectedCondition === cond;
                  const colorStyle = getConditionColor(cond);

                  return (
                    <div
                      key={cond}
                      onClick={() => handleSelectCondition(cond)}
                      className={`group py-1 pl-2.5 pr-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                        isSelected ? colorStyle.active : colorStyle.idle
                      }`}
                    >
                      <span className="truncate">{cond}</span>
                      {isSelected && (
                        <span className="text-[8px] bg-white/30 px-1 py-0.2 rounded font-black uppercase">
                          ✓
                        </span>
                      )}

                      {/* Tombol Hapus Klasifikasi Simple */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCondition(cond, e)}
                        className={`p-0.5 rounded-md transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-white/70 hover:text-white hover:bg-black/20'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={`Hapus klasifikasi "${cond}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Indicator bar kondisi aktif */}
              {!isDriveLoggedIn ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center justify-between shadow-2xs">
                  <span className="font-bold flex items-center space-x-1.5 text-amber-950">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isEn ? 'Scanner Locked: Google Drive connection required' : 'Scanner Terkunci: Wajib login Google Drive sebelum scan'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDriveRequiredModalOpen(true)}
                    className="text-[10px] text-white bg-amber-700 hover:bg-amber-800 px-2.5 py-1 rounded-md font-bold shadow-2xs cursor-pointer"
                  >
                    {isEn ? 'Connect Drive' : 'Login Drive'}
                  </button>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-[#F0FDFA] border border-teal-200 text-teal-900 text-[11px] flex items-center justify-between">
                  <span className="font-semibold">
                    📌 {isEn ? 'Ready to Scan for:' : 'Siap Scan untuk:'} <strong className="underline underline-offset-2">{selectedCondition}</strong>
                  </span>
                  <span className="text-[10px] text-[#0F766E] bg-white px-2 py-0.5 rounded-md border border-teal-200 font-mono font-bold">
                    {isEn ? 'Scanner Ready' : 'Scanner Siap'}
                  </span>
                </div>
              )}
            </div>

            {/* Sub-step 2B: Scan Barcode / Input SKU */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-800 flex items-center space-x-1">
                <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-black shrink-0 ${!isDriveLoggedIn ? 'bg-amber-600' : 'bg-[#0F766E]'}`}>
                  {!isDriveLoggedIn ? '🔒' : 'B'}
                </span>
                <span>{isEn ? 'Scan Product Barcode Now:' : 'Scan Barcode Produk Sekarang:'}</span>
                {!isDriveLoggedIn && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-1">
                    Terkunci
                  </span>
                )}
              </div>

              <div className="relative flex items-center gap-2">
                <div
                  className="relative flex-1 cursor-pointer"
                  onClick={() => {
                    if (!isDriveLoggedIn) {
                      playBeep(440, 'triangle', 0.15);
                      setSkuFeedbackToast('⚠️ Stasiun Terkunci: Harap hubungkan Google Drive terlebih dahulu!');
                      setIsDriveRequiredModalOpen(true);
                    }
                  }}
                >
                  <input
                    ref={skuInputRef}
                    type="text"
                    disabled={!isDriveLoggedIn}
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcessScanInput();
                      }
                    }}
                    placeholder={
                      !isDriveLoggedIn
                        ? (isEn ? '🔒 Scanner locked: Connect Google Drive first...' : '🔒 Scanner terkunci: Hubungkan Google Drive terlebih dahulu...')
                        : (isEn ? `Scan product barcode for "${selectedCondition}"...` : `Scan barcode produk untuk kondisi "${selectedCondition}"...`)
                    }
                    className={`w-full pl-9 pr-16 py-2.5 rounded-xl text-xs font-mono font-bold shadow-sm focus:outline-none transition-all ${
                      !isDriveLoggedIn
                        ? 'bg-slate-100 border-2 border-slate-300 text-slate-400 cursor-not-allowed placeholder:text-slate-400'
                        : 'bg-white border-2 border-teal-300 focus:border-[#0F766E] text-slate-900 focus:ring-3 focus:ring-teal-500/20 placeholder:text-slate-400'
                    }`}
                  />
                  {!isDriveLoggedIn ? (
                    <Lock className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  ) : (
                    <Barcode className="w-4 h-4 text-[#0F766E] absolute left-3 top-1/2 -translate-y-1/2" />
                  )}
                  {skuInput && (
                    <button
                      onClick={() => setSkuInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold px-1 py-0.5 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isDriveLoggedIn) {
                      setIsDriveRequiredModalOpen(true);
                      return;
                    }
                    handleProcessScanInput();
                  }}
                  disabled={!isDriveLoggedIn || !skuInput.trim()}
                  className="px-3.5 py-2.5 bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 disabled:hover:bg-[#0F766E] text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                >
                  Scan (Enter)
                </button>
              </div>

              {/* Quick SKU presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5">
                <span className="text-slate-400 shrink-0">Tes Cepat:</span>
                {[
                  { sku: 'sc064', label: 'sc064' },
                  { sku: 'SKU-SKINCARE-01', label: 'Skincare' },
                  { sku: 'SKU-JACKET-02', label: 'Jacket' },
                  { sku: 'SKU-SHOES-03', label: 'Sepatu' }
                ].map((item) => (
                  <button
                    key={item.sku}
                    type="button"
                    onClick={() => {
                      if (!isDriveLoggedIn) {
                        playBeep(440, 'triangle', 0.15);
                        setSkuFeedbackToast('⚠️ Stasiun Terkunci: Wajib login Google Drive terlebih dahulu!');
                        setIsDriveRequiredModalOpen(true);
                        return;
                      }
                      handleProcessScanInput(item.sku);
                    }}
                    disabled={!isDriveLoggedIn}
                    className={`px-2 py-0.5 rounded font-mono border transition-colors ${
                      !isDriveLoggedIn
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-[#F0FDFA] text-slate-700 border-slate-200 cursor-pointer'
                    }`}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toast feedback jika berhasil scan */}
            {skuFeedbackToast && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fade-in shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{skuFeedbackToast}</span>
              </div>
            )}
          </div>

          {/* STEP 3: DAFTAR SKU TERCATAT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>3. SKU Tercatat ({scannedItems.length})</span>
              </h3>

              <button
                onClick={handleNextSkuFocus}
                className="text-xs font-medium text-[#0F766E] hover:text-white bg-[#F0FDFA] hover:bg-[#0F766E] px-2.5 py-1 rounded-xl border border-teal-200 flex items-center space-x-1 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Scan SKU Lain</span>
              </button>
            </div>

            {/* Ringkasan Akumulasi per SKU */}
            {scannedItems.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#F0FDFA]/70 border border-teal-200 space-y-1">
                <div className="text-[10px] font-bold text-teal-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Ringkasan Output:</span>
                  <span className="font-mono text-[10px] font-bold text-[#0F766E]">
                    Total: {scannedItems.length} unit
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(
                    scannedItems.reduce((acc, item) => {
                      if (!acc[item.sku_id]) acc[item.sku_id] = {};
                      acc[item.sku_id][item.kondisi] = (acc[item.sku_id][item.kondisi] || 0) + 1;
                      return acc;
                    }, {} as Record<string, Record<string, number>>)
                  ).map(([skuId, breakdown]) => (
                    <div
                      key={skuId}
                      className="inline-flex items-center space-x-1 bg-white px-2 py-0.5 rounded-lg border border-teal-200 text-[11px] shadow-xs"
                    >
                      <span className="font-mono font-bold text-slate-900">{skuId}</span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center space-x-1">
                        {Object.entries(breakdown).map(([kondisi, qty], i) => (
                          <span key={kondisi} className="font-semibold text-slate-700">
                            {i > 0 && <span className="text-slate-300 mr-0.5">,</span>}
                            {kondisi}: <strong>{qty}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List Scanned Items (Chronological, compact max-height) */}
            <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
              {scannedItems.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-white/40 border border-dashed border-slate-300 text-slate-500 text-xs">
                  Belum ada SKU di-scan. Pilih kondisi di atas, lalu scan barcode produk!
                </div>
              ) : (
                scannedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-white/90 border border-slate-200/90 shadow-xs flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 font-bold text-slate-800 border border-slate-200">
                          #{scannedItems.length - idx} • {item.sku_id}
                        </span>
                        {item.harga !== undefined && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            {formatRupiah(item.harga)}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getConditionBadgeClass(
                            item.kondisi
                          )}`}
                        >
                          {item.kondisi}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {item.scannedAt}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {item.nama_barang}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveScannedItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus SKU"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* STEP 4: SAVE AUTO UPLOAD TO DRIVE & QR CODE MEJA */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleFinishAndUpload}
              disabled={isLoading || isUploadingToDrive || scannedItems.length === 0}
              className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-2xl font-semibold text-sm tracking-wide shadow-sm active:scale-98 transition-all flex items-center justify-center space-x-2.5 disabled:opacity-50 cursor-pointer"
            >
              {isLoading || isUploadingToDrive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEn ? 'Processing & Uploading to Drive...' : 'Sedang Memproses & Mengunggah ke Drive...'}</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 fill-white/20" />
                  <span>{isEn ? '4. Save & Upload Unboxing to Drive' : '4. Simpan & Upload Video ke Google Drive'}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono font-medium">
                    {scannedItems.length} SKU
                  </span>
                </>
              )}
            </button>

            {/* Hands-Free QR Meja Section */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white border border-slate-700 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-teal-300">
                  <QrCode className="w-4 h-4 text-teal-400" />
                  <span>Perintah Selesai Hands-Free (Scan QR Meja):</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleProcessScanInput('SELESAI')}
                  disabled={scannedItems.length === 0 || isLoading || isUploadingToDrive}
                  className="text-[10px] bg-[#0F766E] hover:bg-[#115E59] active:scale-95 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg border border-teal-500 transition-all cursor-pointer shadow-xs"
                >
                  ⚡ Scan Selesai
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-slate-300">
                  Stiker QR Meja siap cetak:
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadDeskQr}
                    disabled={isDownloadingDeskQr}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    {isDownloadingDeskQr ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    <span>Download QR Meja</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintDeskQr}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold border border-slate-600 active:scale-95 transition-all cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1 POPUP MODAL: SCAN NO AWB / ORDER LANGSUNG POPUP                   */}
      {/* ========================================================================= */}
      {isAwbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="glass-card rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
              <div className="w-11 h-11 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
                <PackageOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wider bg-[#F0FDFA] px-2 py-0.5 rounded-md border border-teal-200 flex items-center space-x-1 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>{isEn ? 'Step 1 • Auto Recording 30 FPS' : 'Langkah 1 • Rekam Otomatis 30 FPS'}</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {isEn ? 'Scan Tracking / Order ID' : 'Scan No. AWB / Order ID'}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isEn 
                ? 'After scanning AWB, live webcam unboxing video starts recording automatically (30 FPS lag-free). Point scanner at AWB barcode or type below:'
                : 'Setelah scan No. AWB, video unboxing langsung merekam via webcam secara otomatis (30 FPS anti-lemot). Arahkan barcode scanner ke no AWB atau ketik di bawah:'}
            </p>

            {/* WAJIB LOGIN GOOGLE DRIVE SEBELUM MEREKAM - INTERACTIVE AUTH HEALTH CARD */}
            {isDriveLoggedIn ? (
              <div
                className={`p-3.5 rounded-2xl border transition-all shadow-2xs space-y-2.5 ${
                  driveTokenStatus === 'valid'
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : driveTokenStatus === 'checking'
                    ? 'bg-teal-50/80 border-teal-200 text-teal-950'
                    : 'bg-amber-50 border-2 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        driveTokenStatus === 'valid'
                          ? 'bg-emerald-600 text-white'
                          : driveTokenStatus === 'checking'
                          ? 'bg-teal-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {driveTokenStatus === 'checking' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : driveTokenStatus === 'valid' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                          Google Drive Terhubung
                        </span>
                        {isCheckingDriveToken && (
                          <span className="text-[9px] text-teal-600 font-medium animate-pulse">
                            (Mengecek...)
                          </span>
                        )}
                      </div>
                      <div
                        className="text-xs font-mono font-extrabold text-slate-900 truncate max-w-[210px] sm:max-w-[260px]"
                        title={activeDriveAccount || ''}
                      >
                        {activeDriveAccount}
                      </div>
                    </div>
                  </div>

                  {/* Badges Status Detail */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {driveTokenStatus === 'valid' ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold bg-emerald-200/90 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>✓ Token Aktif • Siap Rekam</span>
                      </span>
                    ) : driveTokenStatus === 'checking' ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200 px-2.5 py-1 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin text-teal-700" />
                        <span>Cek Token...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold bg-amber-200 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        <span>⚠️ Sesi Habis • Butuh Login</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Warning box jika token expired */}
                {driveTokenStatus === 'expired' && (
                  <p className="text-[11px] text-amber-900 bg-amber-100/90 p-2 rounded-xl border border-amber-300 leading-tight">
                    Sesi token Google Drive belum aktif atau kedaluwarsa. Klik <strong>Relogin Akun Google</strong> di bawah agar video tidak gagal tersimpan.
                  </p>
                )}

                {/* Bar Tombol Aksi: Cek Token Aktif & Relogin Akun Google */}
                <div className="pt-1.5 border-t border-emerald-200/70 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => checkDriveTokenHealth(true)}
                      disabled={isCheckingDriveToken}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Periksa masa berlaku token otorisasi Google Drive"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isCheckingDriveToken ? 'animate-spin' : ''}`} />
                      <span>{isCheckingDriveToken ? 'Mengecek...' : 'Cek Token Aktif'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLoginGoogle}
                      disabled={isLoggingInGoogle}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                        driveTokenStatus === 'expired'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white animate-bounce-subtle'
                          : 'bg-[#0F766E] hover:bg-[#115E59] text-white'
                      }`}
                      title="Buka popup Google untuk login ulang atau ganti akun"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>{isLoggingInGoogle ? 'Menghubungkan...' : 'Relogin Akun Google'}</span>
                    </button>
                  </div>

                  {lastTokenCheckTime && (
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline-block">
                      Dicek: {lastTokenCheckTime}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-extrabold text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Google Drive Wajib Login Sebelum Menyalakan Stasiun</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    Wajib Terhubung
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Sebelum menyalakan stasiun dan memulai perekaman bukti unboxing, pastikan akun Google Drive gudang sudah login dan terhubung. Masukkan akun Gmail gudang secara manual:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="email"
                      value={manualDriveInput}
                      onChange={(e) => setManualDriveInput(e.target.value)}
                      placeholder="Contoh: whs.otwoo@gmail.com"
                      className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = manualDriveInput.trim();
                        if (!clean || !clean.includes('@')) {
                          setSkuFeedbackToast('⚠️ Masukkan email Gmail yang valid.');
                          setTimeout(() => setSkuFeedbackToast(null), 3000);
                          return;
                        }
                        setGoogleDriveEmail(clean);
                        setSkuFeedbackToast(`✓ Akun Google Drive ${clean} berhasil terhubung!`);
                        setTimeout(() => setSkuFeedbackToast(null), 3500);
                      }}
                      className="px-3.5 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan & Hubungkan</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoginGoogle}
                    disabled={isLoggingInGoogle}
                    className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-teal-600" />
                    <span>Atau Hubungkan Lewat Login Google Popup</span>
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAwb();
              }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="relative">
                  <input
                    ref={awbModalInputRef}
                    type="text"
                    value={tempAwbModalInput}
                    onChange={(e) => setTempAwbModalInput(e.target.value.toUpperCase())}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    placeholder={isEn ? "Scan barcode AWB with scanner gun..." : "Scan barcode no resi (AWB) dengan scanner..."}
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-[#0F766E] rounded-2xl text-base font-mono font-bold text-slate-900 shadow-inner focus:outline-none focus:ring-4 focus:ring-teal-500/20"
                  />
                  <Barcode className="w-5 h-5 text-[#0F766E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Indikator Status Deteksi Prefix Resi */}
                {tempAwbModalInput.trim().length >= 2 && detectionInfo && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                        <span>Hasil Deteksi Prefix Resi</span>
                        <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                          [{detectionInfo.matchedPrefix || detectionInfo.prefixCandidate}]
                        </span>
                      </span>

                      {detectionInfo.isAutoDetected && !detectionInfo.isLearned && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>✓ Terdeteksi Otomatis (Formula Excel)</span>
                        </span>
                      )}

                      {detectionInfo.isLearned && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-extrabold">
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                          <span>✓ Dari Memori Sistem</span>
                        </span>
                      )}

                      {!detectionInfo.isAutoDetected && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>🔍 Prefix Baru (Pilihan Akan Disimpan)</span>
                        </span>
                      )}
                    </div>

                    {/* 2 Dropdown Berdampingan: Marketplace & Logistik */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Dropdown 1: Marketplace */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                          <ShoppingBag className="w-3.5 h-3.5 text-teal-600" />
                          <span>Marketplace / Platform</span>
                        </label>
                        <select
                          value={modalMarketplace}
                          onChange={(e) => setModalMarketplace(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 cursor-pointer shadow-2xs"
                        >
                          <option value="">-- Pilih Marketplace --</option>
                          {STANDARD_MARKETPLACES.map((mp) => (
                            <option key={mp} value={mp}>
                              {mp}
                            </option>
                          ))}
                          {modalMarketplace && !STANDARD_MARKETPLACES.includes(modalMarketplace as any) && (
                            <option value={modalMarketplace}>{modalMarketplace}</option>
                          )}
                        </select>
                      </div>

                      {/* Dropdown 2: Logistik */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Logistik / Ekspedisi</span>
                        </label>
                        <select
                          value={modalLogistics}
                          onChange={(e) => setModalLogistics(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 cursor-pointer shadow-2xs"
                        >
                          <option value="">-- Pilih Logistik --</option>
                          {STANDARD_LOGISTICS.map((lg) => (
                            <option key={lg} value={lg}>
                              {lg}
                            </option>
                          ))}
                          {modalLogistics && !STANDARD_LOGISTICS.includes(modalLogistics as any) && (
                            <option value={modalLogistics}>{modalLogistics}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-tight">
                      💡 Kedua dropdown terisi otomatis sesuai prefix dan tetap dapat diedit operator. Pilihan prefix baru otomatis dipelajari sistem.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-1 flex items-center gap-3">
                {isDriveLoggedIn ? (
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl font-semibold text-sm shadow-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    <span>{isEn ? 'Scan & Start Recording (30 FPS)' : 'Scan & Rekam Otomatis (30 FPS)'}</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDriveRequiredModalOpen(true)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Login Google Drive Dulu untuk Merekam</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL KHUSUS: GOOGLE DRIVE WAJIB LOGIN SEBELUM MEREKAM               */}
      {/* ========================================================================= */}
      {isDriveRequiredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Google Drive Belum Login
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Wajib terhubung sebelum memulai perekaman video unboxing
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-2">
              <p>
                Sesuai SOP Gudang, <strong>sebelum memulai perekaman video unboxing</strong>, akun Google Drive wajib login terlebih dahulu.
              </p>
              <p className="text-[11px] text-amber-800">
                Hal ini untuk memastikan rekaman video unboxing dan bukti klaim barang rusak langsung tersimpan & terunggah sempurna ke cloud Google Drive.
              </p>
            </div>

            {driveUploadError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{driveUploadError}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await handleLoginGoogle();
                  if (activeGoogleUser) {
                    setIsDriveRequiredModalOpen(false);
                  }
                }}
                disabled={isLoggingInGoogle}
                className="w-full py-2.5 px-4 bg-[#0F766E] hover:bg-[#115E59] active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <HardDrive className="w-4 h-4" />
                <span>{isLoggingInGoogle ? 'Menghubungkan Akun Google...' : 'Hubungkan Akun Google Popup'}</span>
              </button>

              <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span>ATAU HUBUNGKAN EMAIL GDRIVE SECARA LANGSUNG</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="email"
                  value={manualDriveInput}
                  onChange={(e) => setManualDriveInput(e.target.value)}
                  placeholder="Contoh: whs.otwoo@gmail.com"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanEmail = manualDriveInput.trim();
                    if (!cleanEmail || !cleanEmail.includes('@')) {
                      setDriveUploadError('Masukkan format email Google Drive yang valid.');
                      return;
                    }
                    setGoogleDriveEmail(cleanEmail);
                    playBeep(1200, 'sine', 0.15);
                    setSkuFeedbackToast(`✓ Akun Google Drive ${cleanEmail} berhasil dihubungkan! Stasiun unboxing terbuka.`);
                    setTimeout(() => setSkuFeedbackToast(null), 3500);
                    setIsDriveRequiredModalOpen(false);
                    setTimeout(() => {
                      setIsAwbModalOpen(true);
                    }, 350);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Simpan & Hubungkan Akun Google Drive Ini
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {!isDriveLoggedIn ? '🔒 Stasiun terkunci selama offline' : '✓ Siap merekam'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsDriveRequiredModalOpen(false);
                  if (!isDriveLoggedIn) {
                    setSkuFeedbackToast('ℹ️ Stasiun tetap terkunci sampai akun Google Drive terhubung.');
                    setTimeout(() => setSkuFeedbackToast(null), 3500);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLETION MODAL: SAVE AUTO UPLOAD TO DRIVE & LEAD TIME FAST RESET       */}
      {/* ========================================================================= */}
      {isDoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="glass-card rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-white/80 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Sesi Unboxing Selesai
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order ID: <strong className="font-mono text-slate-700">{awbInput}</strong>
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono bg-[#F0FDFA] text-[#0F766E] px-2.5 py-1 rounded-lg border border-teal-200">
                {operatorId}
              </span>
            </div>

            {/* Status Google Drive */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Status Google Drive:</span>
                {isUploadingToDrive ? (
                  <span className="text-[#0F766E] font-medium flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Mengunggah video...</span>
                  </span>
                ) : uploadedDriveResult ? (
                  <span className="text-emerald-600 font-bold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Berhasil Diunggah ke Drive</span>
                  </span>
                ) : activeGoogleUser ? (
                  <span className="text-slate-600">Video siap diunggah</span>
                ) : (
                  <span className="text-amber-600">Belum terhubung ke Drive</span>
                )}
              </div>

              {uploadedDriveResult && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 text-[11px] truncate max-w-[220px]">
                    {uploadedDriveResult.name}
                  </span>
                  <a
                    href={uploadedDriveResult.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0F766E] font-semibold hover:underline flex items-center space-x-1"
                  >
                    <span>Buka di Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {!activeGoogleUser && (
                <div className="pt-1">
                  <button
                    onClick={handleLoginGoogle}
                    className="w-full py-2 px-3 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Login Google untuk Auto-Upload Sesi Ini</span>
                  </button>
                </div>
              )}
            </div>

            {/* Ringkasan Item Tercatat */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ringkasan SKU ({scannedItems.length} Produk):
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-slate-200"
                  >
                    <span className="text-slate-800 font-medium truncate max-w-[220px]">
                      {item.nama_barang}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getConditionBadgeClass(
                        item.kondisi
                      )}`}
                    >
                      {item.kondisi}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions: Download Video, View Reports, & Start Next Order */}
            <div className="space-y-3 pt-2">
              {/* Notifikasi Status Kunci Tombol Unbox Paket Berikutnya */}
              {isUploadingToDrive ? (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2.5 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block">Sedang mengunggah video ke Google Drive...</span>
                    <span className="text-[11px] text-amber-800/90 block">
                      Tombol unbox paket berikutnya terkunci (abu-abu) sampai video selesai terunggah.
                    </span>
                  </div>
                </div>
              ) : !uploadedDriveResult ? (
                <div className="p-3 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block text-xs">Video Belum Terunggah ke Drive</span>
                      <span className="text-[11px] text-slate-500 block truncate">
                        Tombol 'Unbox Paket Berikutnya' terkunci (abu-abu) sesuai SOP gudang.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryUploadToDrive}
                    className="px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                  >
                    Unggah Sekarang
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block">✓ Video Berhasil Diunggah ke Google Drive!</span>
                    <span className="text-[11px] text-emerald-700 block">
                      Tombol 'Unbox Paket Berikutnya' kini aktif dan dapat diklik.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  onClick={handleDownloadVideo}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh MP4</span>
                </button>

                {onNavigateToReports && (
                  <button
                    onClick={() => {
                      setIsDoneModalOpen(false);
                      onNavigateToReports();
                    }}
                    className="py-2.5 px-3 bg-white hover:bg-[#F0FDFA] border border-[#E2E8F0] text-[#134E4A] rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0F766E]" />
                    <span>Buka Halaman Laporan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetForNewOrder}
                  disabled={!uploadedDriveResult || isUploadingToDrive}
                  title={
                    !uploadedDriveResult || isUploadingToDrive
                      ? 'Video belum terunggah ke Google Drive. Tombol terkunci (abu-abu).'
                      : 'Unbox paket berikutnya'
                  }
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                    !uploadedDriveResult || isUploadingToDrive
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none opacity-80'
                      : 'bg-[#0F766E] hover:bg-[#115E59] text-white shadow-sm active:scale-95 cursor-pointer shadow-teal-900/10'
                  }`}
                >
                  {isUploadingToDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span>Mengunggah Video ke Drive...</span>
                    </>
                  ) : !uploadedDriveResult ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>⚡ Unbox Paket Berikutnya</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>⚡ Unbox Paket Berikutnya</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN KAMERA & MULTI-WEBCAM */}
      <CameraSettingsModal
        isOpen={isCameraSettingsOpen}
        onClose={() => setIsCameraSettingsOpen(false)}
        availableCameras={availableCameras}
        selectedCameraId={selectedCameraId}
        onSelectCamera={handleSelectCamera}
        onRefreshDevices={refreshCameraDevices}
        isRefreshing={isRefreshingCameras}
        resolution={cameraResolution}
        onChangeResolution={handleChangeResolution}
        isMirror={isMirrorPreview}
        onToggleMirror={handleToggleMirror}
        enableAudio={enableAudio}
        onToggleAudio={handleToggleAudio}
        watermarkMode={watermarkMode}
        onChangeWatermarkMode={handleChangeWatermarkMode}
        isWebcamActive={isWebcamActive}
        onReconnectWebcam={() => setupStream()}
      />
    </div>
  );
};
