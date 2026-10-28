import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Boxes,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { useLanguage } from '../context/LanguageContext';

export const LoginScreen: React.FC = () => {
  const { authenticateWithPin, companyName, appName } = useAccount();
  const { isEn } = useLanguage();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCredentialHint, setShowCredentialHint] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage(isEn ? 'Please enter Operator ID / Username.' : 'Harap masukkan ID Operator atau Username Anda.');
      identifierRef.current?.focus();
      return;
    }
    if (!pin.trim()) {
      setErrorMessage(isEn ? 'Please enter your Security PIN.' : 'Harap masukkan PIN keamanan Anda.');
      pinRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      const res = authenticateWithPin(identifier.trim(), pin.trim());
      if (res.success) {
        setIsSuccess(true);
        // Login berhasil, state hasLoggedIn akan diperbarui oleh AccountContext
      } else {
        setIsSubmitting(false);
        setErrorMessage(res.message);
        setPin('');
        pinRef.current?.focus();
      }
    }, 250);
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleQuickFill = (testId: string, testPin: string) => {
    setIdentifier(testId);
    setPin(testPin);
    setErrorMessage(null);
    setTimeout(() => {
      pinRef.current?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 flex flex-col justify-between text-slate-100 font-sans p-4 sm:p-6 relative overflow-hidden selection:bg-teal-500/30">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Kecil Atas */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10 pt-2 sm:pt-4">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Boxes className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <div>
            <span className="text-sm font-extrabold tracking-tight text-white">{appName || 'unboxin.id'}</span>
            <div className="text-[10px] text-teal-400 font-medium">Terminal Gudang</div>
          </div>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cloud Mirroring Aktif</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative">
          
          {/* Judul & Ikon Kunci */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-3 text-teal-400 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isEn ? 'Authorized Station Sign In' : 'Masuk Stasiun Gudang'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              {isEn
                ? 'Enter your operator credentials and security PIN to access the workstation.'
                : 'Masukkan ID Operator dan PIN keamanan rahasia Anda untuk membuka akses stasiun.'}
            </p>
          </div>

          {/* Alert Error */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isEn ? 'Operator ID / Username' : 'ID Operator / Username / Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  ref={identifierRef}
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  disabled={isSubmitting || isSuccess}
                  placeholder="Contoh: yaya.sanjaya / OPR-HQ-01"
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 transition outline-none"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Input PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {isEn ? 'Security PIN' : 'PIN Keamanan (4-6 Digit)'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition"
                >
                  {showKeypad ? 'Sembunyikan Keypad' : 'Buka Keypad Layar'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setPin(clean);
                    setErrorMessage(null);
                  }}
                  disabled={isSubmitting || isSuccess}
                  placeholder="••••"
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 tracking-widest transition outline-none"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Virtual Keypad (Untuk Layar Sentuh / Tablet / HP) */}
            {showKeypad && (
              <div className="pt-2 pb-1">
                <div className="grid grid-cols-3 gap-2 bg-slate-950/90 p-3 rounded-2xl border border-slate-800">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-base border border-slate-800 transition"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="py-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800 text-slate-400 font-semibold text-xs transition"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-base border border-slate-800 transition"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800 active:scale-95 text-rose-400 font-semibold text-xs transition"
                  >
                    ⌫ Hapus
                  </button>
                </div>
              </div>
            )}

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-teal-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950 animate-bounce" />
                  <span>{isEn ? 'Authenticated! Opening...' : 'Autentikasi Berhasil! Membuka...'}</span>
                </>
              ) : isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{isEn ? 'Verifying Credentials...' : 'Memverifikasi ID & PIN...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isEn ? 'Sign In to Station' : 'Masuk ke Sistem Gudang'}</span>
                </>
              )}
            </button>
          </form>

          {/* Accordion Bantuan Kredensial Bawaan (Tertutup Default untuk Keamanan) */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowCredentialHint(!showCredentialHint)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition py-1"
            >
              <div className="flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
                <span>Petunjuk Akun & Kredensial Staf Resmi</span>
              </div>
              {showCredentialHint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCredentialHint && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs space-y-2.5 animate-fadeIn">
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Gunakan salah satu ID Operator berikut beserta PIN bawaan (<span className="text-teal-300 font-mono font-bold">1234</span>):
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {[
                    { role: 'Super Admin', id: 'yaya.sanjaya', code: 'OPR-HQ-01', name: 'Yaya Sanjaya' },
                    { role: 'Warehouse Mgr', id: 'budi.santoso', code: 'MGR-WH-02', name: 'Budi Santoso' },
                    { role: 'Operator Meja 1', id: 'opr.agus', code: 'OPR-992', name: 'Agus Pratama' },
                    { role: 'Operator Meja 2', id: 'opr.dewi', code: 'OPR-101', name: 'Dewi Lestari' },
                    { role: 'CS & Dispute', id: 'cs.rina', code: 'CS-CLM-05', name: 'Rina Anggraini' }
                  ].map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => handleQuickFill(acc.id, '1234')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-teal-950/60 border border-slate-800/80 hover:border-teal-500/40 cursor-pointer flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-white text-xs group-hover:text-teal-300">{acc.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {acc.id} • {acc.code}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-800/60">
                        {acc.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Bawah */}
      <footer className="max-w-md w-full mx-auto text-center text-xs text-slate-500 z-10 pb-2">
        <div>
          <span>{appName || 'unboxin.id'}</span>
          <span className="mx-2">•</span>
          <span>{companyName || 'PT. Tirta Kumala Sari'}</span>
          <span className="mx-2">•</span>
          <span>Copyright by Yaya Sanjaya</span>
        </div>
      </footer>
    </div>
  );
};
