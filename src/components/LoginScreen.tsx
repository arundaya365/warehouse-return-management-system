import React, { useState, useRef, useEffect } from 'react';
import { Lock, User, KeyRound, Eye, EyeOff, LogIn, AlertCircle, Boxes, CheckCircle2 } from 'lucide-react';
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

  const identifierRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
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

    const res = await authenticateWithPin(identifier.trim(), pin.trim());
    if (res.success) {
      setIsSuccess(true);
      // Login berhasil, state hasLoggedIn akan diperbarui oleh AccountContext
    } else {
      setIsSubmitting(false);
      setErrorMessage(res.message);
      setPin('');
      pinRef.current?.focus();
    }
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

  return (
    <div className="min-h-screen bg-[#f7f5ff] flex flex-col justify-between text-slate-900 font-sans p-4 sm:p-6 relative overflow-hidden selection:bg-violet-200">
      
      {/* Background Decorative Glow */}
      <div className="absolute -top-40 -right-32 w-[520px] h-[520px] bg-violet-200/55 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -left-24 w-[460px] h-[460px] bg-indigo-100/70 rounded-full blur-3xl pointer-events-none" />

      {/* Header Kecil Atas */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10 pt-2 sm:pt-4">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-extrabold tracking-tight text-slate-950">{appName || 'onboxin'}</span>
            <div className="text-[10px] text-violet-600 font-semibold">Warehouse workspace</div>
          </div>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-violet-100 text-[11px] text-slate-500 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Secure workspace</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-6">
        <div className="bg-white/95 backdrop-blur-xl border border-violet-100 rounded-3xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(79,70,229,0.14)] relative">
          
          {/* Judul & Ikon Kunci */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 mb-3 text-violet-600 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
              {isEn ? 'Welcome back' : 'Masuk ke onboxin'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {isEn
                ? 'Enter your operator credentials and security PIN to access the workstation.'
                : 'Masukkan ID Operator dan PIN keamanan rahasia Anda untuk membuka akses stasiun.'}
            </p>
          </div>

          {/* Alert Error */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isEn ? 'Operator ID / Username' : 'ID Operator / Username / Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="w-full bg-white border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-[border-color,box-shadow] outline-none"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Input PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {isEn ? 'Security PIN' : 'PIN Keamanan (4-6 Digit)'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="text-[11px] text-violet-600 hover:text-violet-700 font-semibold transition-colors"
                >
                  {showKeypad ? 'Sembunyikan Keypad' : 'Buka Keypad Layar'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="w-full bg-white border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 tracking-widest transition-[border-color,box-shadow] outline-none"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-violet-700 transition-colors"
                  title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Virtual Keypad (Untuk Layar Sentuh / Tablet / HP) */}
            {showKeypad && (
              <div className="pt-2 pb-1">
                <div className="grid grid-cols-3 gap-2 bg-violet-50 p-3 rounded-2xl border border-violet-100">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="py-2.5 rounded-xl bg-white hover:bg-violet-100 active:scale-95 text-slate-900 font-bold text-base border border-violet-100 transition-[background-color,transform]"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="py-2.5 rounded-xl bg-white/70 hover:bg-violet-100 text-slate-500 font-semibold text-xs transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-2.5 rounded-xl bg-white hover:bg-violet-100 active:scale-95 text-slate-900 font-bold text-base border border-violet-100 transition-[background-color,transform]"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 rounded-xl bg-white/70 hover:bg-rose-50 active:scale-95 text-rose-600 font-semibold text-xs transition-[background-color,transform]"
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
              className="w-full mt-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-200 flex items-center justify-center space-x-2 transition-[background-color,box-shadow,transform] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>{isEn ? 'Authenticated! Opening...' : 'Autentikasi Berhasil! Membuka...'}</span>
                </>
              ) : isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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



