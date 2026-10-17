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
  Barcode,
  Search,
  Save,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
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
  onGoogleSignIn
}) => {
  const {
    users,
    currentUser,
    authenticateWithPin,
    googleDriveEmail,
    setGoogleDriveEmail,
    companyName,
    hasLoggedIn,
    targetLoginUser,
    setTargetLoginUser
  } = useAccount();
  const { isEn } = useLanguage();

  // Active selected operator
  const [selectedUserObj, setSelectedUserObj] = useState(
    targetLoginUser || currentUser || users[0]
  );
  const [operatorSearch, setOperatorSearch] = useState<string>('');

  // PIN Input State
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSuccessState, setIsSuccessState] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Drive Config Accordion State
  const [showDriveConfig, setShowDriveConfig] = useState<boolean>(false);
  const [driveEmailInput, setDriveEmailInput] = useState<string>(
    googleUser?.email || googleDriveEmail || ''
  );
  const [driveSaveSuccess, setDriveSaveSuccess] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Sync if targetLoginUser changes (e.g. from switch user prompt)
  useEffect(() => {
    if (targetLoginUser) {
      setSelectedUserObj(targetLoginUser);
      setPinInput('');
      setErrorMessage(null);
      setIsSuccessState(false);
    } else if (currentUser) {
      setSelectedUserObj(currentUser);
    }
  }, [targetLoginUser, currentUser]);

  // Focus input when modal opens or user switches
  useEffect(() => {
    if (isOpen) {
      setIsSuccessState(false);
      setErrorMessage(null);
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedUserObj]);

  // Audio tone generator
  const playSound = (type: 'success' | 'error' | 'click') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'success') {
        // High harmonic double-tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start(ctx.currentTime + 0.08);
        osc1.stop(ctx.currentTime + 0.25);
        osc2.stop(ctx.currentTime + 0.25);
      } else if (type === 'error') {
        // Low discordant buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else {
        // Subtle key click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch {}
  };

  if (!isOpen) return null;

  // Execute verification
  const executeVerification = (pinToTest: string) => {
    if (!selectedUserObj) return;
    setIsVerifying(true);
    setErrorMessage(null);

    const result = authenticateWithPin(selectedUserObj.operatorCode, pinToTest);
    if (!result.success) {
      playSound('error');
      setIsShaking(true);
      setErrorMessage(result.message || 'PIN yang Anda masukkan salah. Silakan coba kembali.');
      setPinInput('');
      setTimeout(() => {
        setIsShaking(false);
        setIsVerifying(false);
        pinInputRef.current?.focus();
      }, 400);
      return;
    }

    // Success flow
    playSound('success');
    setIsSuccessState(true);
    setIsVerifying(false);

    // Save drive email if modified
    if (driveEmailInput.trim() && driveEmailInput.includes('@')) {
      setGoogleDriveEmail(driveEmailInput.trim());
    }

    setTimeout(() => {
      setTargetLoginUser(null);
      setIsSuccessState(false);
      onClose();
    }, 450);
  };

  // Auto-verification engine: verifies as soon as target PIN length is reached
  const handlePinChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
    setPinInput(clean);
    setErrorMessage(null);

    const expectedLength = selectedUserObj?.pin?.length || 4;
    if (clean.length === expectedLength) {
      executeVerification(clean);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length < 6 && !isVerifying && !isSuccessState) {
      playSound('click');
      const nextPin = pinInput + digit;
      handlePinChange(nextPin);
    }
  };

  const handleBackspace = () => {
    playSound('click');
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClearPin = () => {
    playSound('click');
    setPinInput('');
    setErrorMessage(null);
    pinInputRef.current?.focus();
  };

  const handleSelectUser = (user: typeof users[0]) => {
    setSelectedUserObj(user);
    setPinInput('');
    setErrorMessage(null);
    setIsSuccessState(false);
    playSound('click');
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 60);
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
    playSound('click');
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
          'Domain aplikasi ini belum didaftarkan di Firebase Authorized Domains. Gunakan login ID Operator & PIN Anda di atas. Google Drive dapat dihubungkan manual via alamat email di bawah.'
        );
      } else if (msg.includes('popup-closed-by-user') || msg.includes('popup-blocked')) {
        setErrorMessage('Popup Google ditutup atau diblokir peramban. Anda tetap bisa login menggunakan ID Operator & PIN di atas.');
      } else {
        setErrorMessage(msg || 'Gagal menghubungkan Google Sign-In.');
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleCancelModal = () => {
    if (!hasLoggedIn) {
      setErrorMessage('Silakan pilih akun dan masukkan PIN untuk mengakses stasiun kerja.');
      return;
    }
    setTargetLoginUser(null);
    onClose();
  };

  // Filtered operators for directory
  const filteredUsers = users.filter((u) => {
    if (!operatorSearch.trim()) return true;
    const q = operatorSearch.trim().toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.operatorCode.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const effectiveDriveAccount = googleUser?.email || googleDriveEmail || driveEmailInput;
  const isDriveConfigured = Boolean(effectiveDriveAccount && effectiveDriveAccount.includes('@'));
  const activeRoleDef = ROLE_DEFINITIONS[selectedUserObj.role];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        
        {/* Top Header Banner */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-900 via-[#0F766E] to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200">
                  {companyName}
                </span>
                <span className="text-white/40">·</span>
                <span className="text-[11px] font-medium text-teal-100">Stasiun Unboxing</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                {targetLoginUser
                  ? `Verifikasi Pergantian Shift: ${targetLoginUser.fullName}`
                  : hasLoggedIn
                  ? 'Ganti Operator / Masuk Akun'
                  : 'Otentikasi Stasiun Kerja'}
              </h2>
            </div>
          </div>

          {hasLoggedIn && (
            <button
              type="button"
              onClick={handleCancelModal}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body: Two-Column Responsive Split */}
        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[78vh] overflow-y-auto">
          
          {/* LEFT COLUMN: Operator Card Selector (5 cols) */}
          <div className="md:col-span-5 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 p-4 sm:p-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Pilih Operator:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredUsers.length} Akun
              </span>
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={operatorSearch}
                onChange={(e) => setOperatorSearch(e.target.value)}
                placeholder="Cari nama atau kode..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E] transition-all"
              />
            </div>

            {/* Operator Cards Directory */}
            <div className="space-y-1.5 overflow-y-auto max-h-56 md:max-h-[360px] pr-1">
              {filteredUsers.map((u) => {
                const isSelected = selectedUserObj?.id === u.id;
                const roleDef = ROLE_DEFINITIONS[u.role];
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
                      isSelected
                        ? 'bg-white border-[#0F766E] shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-white/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${
                        u.avatarColor || 'from-[#0F766E] to-[#115E59]'
                      } text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                    >
                      {u.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {u.fullName}
                        </span>
                        <span className="font-mono text-[10px] text-[#0F766E] font-semibold shrink-0 ml-1">
                          {u.operatorCode}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center space-x-1.5">
                        <span>{roleDef?.labelId || u.role}</span>
                        <span>·</span>
                        <span className="truncate">{u.department}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  Tidak ada operator yang cocok dengan "{operatorSearch}".
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Refined PIN Entry Console (7 cols) */}
          <div className="md:col-span-7 p-5 sm:p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Active Operator Banner */}
              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100/90 flex items-center space-x-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${
                    selectedUserObj.avatarColor || 'from-[#0F766E] to-[#115E59]'
                  } text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm`}
                >
                  {selectedUserObj.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">
                    Operator Aktif
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm truncate">
                    {selectedUserObj.fullName}
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-600">
                    <span className="font-mono font-bold text-[#0F766E]">
                      {selectedUserObj.operatorCode}
                    </span>
                    <span>·</span>
                    <span>{activeRoleDef?.labelId || selectedUserObj.role}</span>
                  </div>
                </div>
              </div>

              {/* Error / Alert Messages */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2.5 text-xs animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* PIN Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#0F766E]" />
                    <span>Masukkan PIN Keamanan:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKeypad(!showKeypad)}
                    className="text-[11px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    {showKeypad ? 'Tutup Keypad' : 'Buka Keypad Layar'}
                  </button>
                </div>

                {/* Standard Masked Password Input with Auto-Verification */}
                <div className="relative">
                  <input
                    ref={pinInputRef}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pinInput}
                    disabled={isVerifying || isSuccessState}
                    onChange={(e) => handlePinChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (pinInput.length >= 4) {
                          executeVerification(pinInput);
                        }
                      }
                    }}
                    placeholder="Ketik 4-6 digit PIN keamanan"
                    className={`w-full pl-11 pr-12 py-3 bg-white border rounded-2xl font-mono text-center text-xl tracking-widest font-extrabold text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:text-xs placeholder:font-normal focus:outline-none transition-all shadow-inner ${
                      isSuccessState
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : isShaking
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-300 focus:border-[#0F766E] focus:ring-2 focus:ring-teal-500/20'
                    }`}
                  />

                  {/* Left Key Icon or Success Icon */}
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isSuccessState ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-scale-up" />
                    ) : (
                      <KeyRound className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  {/* Right Show/Hide Password Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
                    title={showPin ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>Otomatis verifikasi saat digit lengkap</span>
                  <span className="font-mono text-slate-500">{pinInput.length}/6 Digit</span>
                </div>
              </div>

              {/* Ergonomic Touch Numpad (for Warehouse Touchscreens / Tablets) */}
              {showKeypad && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-fade-in">
                  <div className="grid grid-cols-3 gap-1.5 max-w-[280px] mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadPress(digit)}
                        className="h-11 bg-white hover:bg-teal-50 active:scale-95 text-slate-800 rounded-xl text-base font-bold font-mono border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleClearPin}
                      className="h-11 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center"
                      title="Hapus Semua"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-11 bg-white hover:bg-teal-50 active:scale-95 text-slate-800 rounded-xl text-base font-bold font-mono border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="h-11 bg-slate-100 hover:bg-rose-50 active:scale-95 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center"
                      title="Hapus Satu Digit"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Secondary Google Drive Storage Config (Collapsible Drawer) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowDriveConfig(!showDriveConfig)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Cloud className="w-3.5 h-3.5 text-[#0F766E]" />
                    <span className="font-semibold text-slate-700 text-xs">
                      Pengaturan Penyimpanan Video (Google Drive)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isDriveConfigured ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Terhubung
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Belum Diatur
                      </span>
                    )}
                    {showDriveConfig ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {showDriveConfig && (
                  <div className="p-3.5 bg-white space-y-2 border-t border-slate-200 animate-fade-in">
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Video unboxing akan otomatis tersimpan ke folder Google Drive akun berikut:
                    </p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={driveEmailInput}
                        onChange={(e) => setDriveEmailInput(e.target.value)}
                        placeholder="email.gudang@gmail.com"
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveManualDriveEmail}
                        className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0"
                      >
                        <Save className="w-3 h-3" />
                        <span>Simpan</span>
                      </button>
                    </div>

                    {driveSaveSuccess && (
                      <div className="text-[10px] font-semibold text-emerald-700 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Akun Google Drive berhasil diperbarui.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSignInGoogle}
                      disabled={isSigningInGoogle}
                      className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isSigningInGoogle ? 'Menghubungkan...' : 'Login Google Popup (OAuth Drive)'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Otentikasi Aman Stasiun Kerja</span>
              </div>

              <div className="flex items-center space-x-2">
                {hasLoggedIn && (
                  <button
                    type="button"
                    onClick={handleCancelModal}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => executeVerification(pinInput)}
                  disabled={pinInput.length < 4 || isVerifying || isSuccessState}
                  className="px-4.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSuccessState ? 'Terverifikasi' : 'Masuk'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
