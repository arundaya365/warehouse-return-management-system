import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  User,
  ShieldCheck,
  Building2,
  X,
  LogIn,
  ArrowRight,
  HardDrive,
  KeyRound,
  Delete,
  RotateCcw,
  Barcode,
  Check,
  LogOut,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';
import { useLanguage } from '../context/LanguageContext';
import type { User as FirebaseUser } from 'firebase/auth';

interface LoginGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser?: FirebaseUser | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
}

export const LoginGateModal: React.FC<LoginGateModalProps> = ({
  isOpen,
  onClose,
  googleUser,
  onGoogleSignIn,
  onGoogleLogout
}) => {
  const {
    users,
    currentUser,
    authenticateWithPin,
    resetToDefaultUsers,
    googleDriveEmail,
    setGoogleDriveEmail,
    companyName,
    hasLoggedIn,
    targetLoginUser,
    setTargetLoginUser
  } = useAccount();
  const { isEn } = useLanguage();

  // Selected operator code / ID
  const [operatorInput, setOperatorInput] = useState<string>(
    targetLoginUser?.operatorCode || currentUser?.operatorCode || 'OPR-HQ-01'
  );
  const [selectedUserObj, setSelectedUserObj] = useState(
    targetLoginUser || currentUser || users[0]
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [driveEmailInput, setDriveEmailInput] = useState<string>(
    googleUser?.email || googleDriveEmail || ''
  );
  const [driveSaveSuccess, setDriveSaveSuccess] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Sync if targetLoginUser changes
  useEffect(() => {
    if (targetLoginUser) {
      setSelectedUserObj(targetLoginUser);
      setOperatorInput(targetLoginUser.operatorCode);
      setPinInput('');
      setErrorMessage(null);
    } else if (currentUser) {
      setSelectedUserObj(currentUser);
      setOperatorInput(currentUser.operatorCode);
    }
  }, [targetLoginUser, currentUser]);

  // Sync selected user when operator input matches
  useEffect(() => {
    const clean = operatorInput.trim().toUpperCase();
    const matched = users.find(
      (u) =>
        u.operatorCode.trim().toUpperCase() === clean ||
        u.id.trim().toUpperCase() === clean ||
        u.username.trim().toUpperCase() === clean ||
        (u.email && u.email.trim().toUpperCase() === clean)
    );
    if (matched) {
      setSelectedUserObj(matched);
    }
  }, [operatorInput, users]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Audio feedback
  const playKeyBeep = (freq = 600) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    if (pinInput.length < 6) {
      playKeyBeep(700);
      setPinInput((prev) => prev + val);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    playKeyBeep(450);
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClearPin = () => {
    playKeyBeep(350);
    setPinInput('');
    setErrorMessage(null);
  };

  const handleSelectUserQuick = (user: typeof users[0]) => {
    setSelectedUserObj(user);
    setOperatorInput(user.operatorCode);
    setPinInput('');
    setErrorMessage(null);
    playKeyBeep(850);
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 50);
  };

  // 1-Klik Quick Login
  const handleInstantLogin = (operatorCode: string, pin: string = '1234') => {
    setOperatorInput(operatorCode);
    setPinInput(pin);
    setErrorMessage(null);

    const result = authenticateWithPin(operatorCode, pin);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setSuccessMessage(result.message);
    playKeyBeep(950);
    setTimeout(() => {
      setSuccessMessage(null);
      setTargetLoginUser(null);
      onClose();
    }, 600);
  };

  const handleExecuteLogin = () => {
    setErrorMessage(null);

    const result = authenticateWithPin(operatorInput, pinInput);
    if (!result.success) {
      playKeyBeep(250);
      setErrorMessage(result.message);
      return;
    }

    // Save drive email if modified
    if (driveEmailInput.trim() && driveEmailInput.includes('@')) {
      setGoogleDriveEmail(driveEmailInput.trim());
    }

    setSuccessMessage(result.message);
    playKeyBeep(950);
    setTimeout(() => {
      setSuccessMessage(null);
      setTargetLoginUser(null);
      onClose();
    }, 600);
  };

  const handleResetToDefault = () => {
    resetToDefaultUsers();
    setOperatorInput('OPR-HQ-01');
    setPinInput('1234');
    setSuccessMessage('Semua akun berhasil di-reset ke PIN default: 1234. Anda dapat login sekarang.');
    playKeyBeep(850);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleSaveManualDriveEmail = () => {
    const clean = driveEmailInput.trim();
    if (!clean || !clean.includes('@')) {
      setErrorMessage('Harap masukkan alamat email Google Drive yang valid.');
      return;
    }
    setGoogleDriveEmail(clean);
    setDriveSaveSuccess(true);
    setErrorMessage(null);
    playKeyBeep(850);
    setTimeout(() => setDriveSaveSuccess(false), 3000);
  };

  const handleSignInGoogle = async () => {
    try {
      setIsSigningInGoogle(true);
      setErrorMessage(null);
      await onGoogleSignIn();
      setDriveSaveSuccess(true);
      setTimeout(() => setDriveSaveSuccess(false), 3000);
    } catch (err: any) {
      console.warn('Google Sign In error:', err);
      const msg = err?.message || '';
      if (msg.includes('unauthorized-domain') || msg.includes('auth/unauthorized-domain')) {
        setErrorMessage(
          'Domain aplikasi ini belum didaftarkan di Firebase Authorized Domains. Gunakan login ID Operator & PIN 1234 di atas. Google Drive dapat dihubungkan manual via alamat email di bawah.'
        );
      } else if (msg.includes('popup-closed-by-user') || msg.includes('popup-blocked')) {
        setErrorMessage('Popup Google ditutup atau diblokir peramban. Anda tetap bisa login menggunakan PIN 1234 di atas.');
      } else {
        setErrorMessage(msg || 'Gagal menghubungkan Google Sign-In.');
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleCancelModal = () => {
    if (!hasLoggedIn) {
      setErrorMessage('Silakan login dengan ID Operator & PIN (Default: 1234) untuk mengakses sistem.');
      return;
    }
    setTargetLoginUser(null);
    onClose();
  };

  const effectiveDriveAccount = googleUser?.email || googleDriveEmail || driveEmailInput;
  const isDriveConfigured = Boolean(effectiveDriveAccount && effectiveDriveAccount.includes('@'));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        {/* Top Header Banner */}
        <div className="p-5 bg-gradient-to-r from-teal-900 via-[#0F766E] to-emerald-800 text-white relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-teal-100 border border-white/20">
                <Building2 className="w-3.5 h-3.5 text-teal-200" />
                <span>{companyName}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center space-x-2">
                <span>
                  {targetLoginUser
                    ? `Verifikasi Switch Akun: ${targetLoginUser.fullName}`
                    : hasLoggedIn
                    ? 'Ganti Shift / Login Akun Operator'
                    : 'Login Stasiun Kerja Retur'}
                </span>
              </h2>
              <p className="text-xs text-teal-100/90 leading-relaxed">
                {targetLoginUser
                  ? `Sesuai aturan keamanan, masukkan PIN untuk beralih ke akun ${targetLoginUser.fullName} (${targetLoginUser.operatorCode}).`
                  : 'Gunakan ID Operator & PIN Keamanan 4 Digit (Default: 1234) untuk masuk.'}
              </p>
            </div>

            {hasLoggedIn && (
              <button
                type="button"
                onClick={handleCancelModal}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs text-slate-700">
          {/* Notification Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2 animate-scale-up">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs font-bold">{successMessage}</div>
            </div>
          )}

          {/* ⚡ INSTANT 1-CLICK LOGIN BUTTONS */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-teal-950 text-xs flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-[#0F766E]" />
                <span>Masuk Cepat 1-Klik (Solusi Login Instan):</span>
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                PIN: 1234
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleInstantLogin('OPR-HQ-01', '1234')}
                className="p-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] active:scale-98 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Masuk Super Admin (Akses Penuh)</span>
              </button>

              <button
                type="button"
                onClick={() => handleInstantLogin('OPR-992', '1234')}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 active:scale-98 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center space-x-2 shadow-2xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                <span>Masuk Operator Unboxing</span>
              </button>
            </div>
          </div>

          {/* 1. OPERATOR CARD QUICK PICKER */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Pilih Akun Operator / Scan Barcode ID:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Klik untuk pilih akun</span>
            </label>

            {/* Quick Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
              {users.map((u) => {
                const isSelected = selectedUserObj?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUserQuick(u)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-white border-[#0F766E] shadow-xs ring-2 ring-teal-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${
                        u.avatarColor || 'from-[#0F766E] to-[#115E59]'
                      } text-white flex items-center justify-center font-bold text-[10px] shrink-0`}
                    >
                      {u.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 text-[11px] truncate">{u.fullName.split(' ')[0]}</div>
                      <div className="text-[9px] font-mono text-[#0F766E] font-semibold truncate">{u.operatorCode}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. OPERATOR ID / USERNAME INPUT BOX */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">ID / Kode Operator / Username / Email:</label>
            <div className="relative">
              <input
                type="text"
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                placeholder="Ketik ID Operator (contoh: OPR-HQ-01 atau yaya.sanjaya)"
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
              />
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* 3. PIN / PASSWORD INPUT FIELD (KEYBOARD & NUMPAD DUAL SUPPORT) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>
                  {targetLoginUser
                    ? `Masukkan PIN untuk Akun ${selectedUserObj?.fullName}:`
                    : 'PIN Keamanan (Default: 1234):'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className="text-[11px] font-bold text-[#0F766E] hover:underline cursor-pointer"
              >
                {showKeypad ? 'Sembunyikan Keypad' : 'Buka Keypad Sentuh'}
              </button>
            </div>

            {/* Direct Keyboard Input */}
            <div className="relative">
              <input
                ref={pinInputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setPinInput(clean);
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (pinInput.length >= 4) {
                      handleExecuteLogin();
                    }
                  }
                }}
                placeholder="Ketik 4 digit PIN (Ketik: 1234)"
                className="w-full pl-10 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center text-lg tracking-widest font-extrabold text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:text-xs placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E] shadow-inner"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
                title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Quick helper for default PIN */}
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>PIN bawaan: <strong className="text-teal-700 font-mono">1234</strong></span>
              <button
                type="button"
                onClick={() => {
                  setPinInput('1234');
                  setErrorMessage(null);
                }}
                className="text-[#0F766E] hover:underline font-bold cursor-pointer"
              >
                Isi PIN 1234
              </button>
            </div>

            {/* Numeric Touch Keypad (Optional / Expandable for touchscreens) */}
            {showKeypad && (
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2 border-t border-slate-200">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="py-2.5 bg-white hover:bg-teal-50 active:scale-95 text-slate-800 rounded-xl text-base font-bold font-mono border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearPin}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center"
                  title="Hapus Semua"
                >
                  C
                </button>
                <button
                  key="0"
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="py-2.5 bg-white hover:bg-teal-50 active:scale-95 text-slate-800 rounded-xl text-base font-bold font-mono border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-2.5 bg-slate-100 hover:bg-rose-50 active:scale-95 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center"
                  title="Hapus Satu Digit"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 4. DEFAULT CREDENTIALS INFO & RESET BUTTON */}
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center space-x-1.5 text-amber-950">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Info Password & Kredensial Sistem:</span>
              </span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center space-x-1 cursor-pointer"
                title="Kembalikan semua akun ke PIN 1234"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke PIN 1234</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Sistem stasiun kerja unboxing ini menggunakan <strong>PIN 4-digit angka (Bawaan: 1234)</strong> untuk setiap akun operator & Super Admin. Jika sebelumnya memasukkan kata sandi email pribadi Google, silakan gunakan PIN <strong>1234</strong>.
            </p>
          </div>

          {/* 5. GOOGLE DRIVE GMAIL INPUT (MANUAL & TERHUBUNG SEBELUM MEREKAM) */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-[#0F766E] shrink-0" />
                <span className="text-xs font-bold text-teal-950">
                  Akun Gmail Google Drive (Penyimpanan Video Retur)
                </span>
              </div>
              {isDriveConfigured ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Terhubung
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  ⚠️ Belum Terhubung
                </span>
              )}
            </div>

            <p className="text-[11px] text-teal-800/90 leading-tight">
              Masukkan alamat Gmail untuk Google Drive gudang secara manual agar video unboxing tersimpan ke Google Drive.
            </p>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  value={driveEmailInput}
                  onChange={(e) => setDriveEmailInput(e.target.value)}
                  placeholder="Contoh: whs.otwoo@gmail.com"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
                />
                <button
                  type="button"
                  onClick={handleSaveManualDriveEmail}
                  className="px-3 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>

              {driveSaveSuccess && (
                <div className="text-[10px] font-bold text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Akun Google Drive berhasil dihubungkan!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignInGoogle}
                disabled={isSigningInGoogle}
                className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <HardDrive className="w-3.5 h-3.5 text-teal-600" />
                <span>{isSigningInGoogle ? 'Menghubungkan...' : 'Login Google Popup (Opsi OAuth Drive)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Sistem Stasiun Kerja PT. Tirta Kumala Sari</span>
          </div>

          <div className="flex items-center space-x-2">
            {hasLoggedIn && (
              <button
                type="button"
                onClick={handleCancelModal}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 cursor-pointer transition-colors"
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={handleExecuteLogin}
              disabled={pinInput.length < 4}
              className="px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-teal-900/15 transition-all flex items-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              <span>
                {targetLoginUser ? `Verifikasi & Masuk` : 'Masuk Stasiun Kerja'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
