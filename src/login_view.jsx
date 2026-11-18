import React, { useState, useEffect } from 'react';
import { BookOpen, ShieldCheck, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import uinLogo from './assets/uin_logo.jpg';
import bgLogin from './assets/bg-login.webp';

export function LoginView({ onLogin, onRegister, onForgotPassword, onLookupRoster }) {
  const [role, setRole] = useState('student');
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [nim, setNim] = useState('');
  const [emailName, setEmailName] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rosterVerified, setRosterVerified] = useState(false);
  const [checkingRoster, setCheckingRoster] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Otomatis cek NIM + Email ke Class Roster saat keduanya diisi
  useEffect(() => {
    if (!isRegistering || !onLookupRoster) return;

    const cleanNim = nim.trim();
    const cleanEmailPrefix = emailName.trim();

    setRosterVerified(false);
    setFullName('');

    if (!/^\d{6,}$/.test(cleanNim) || cleanEmailPrefix.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingRoster(true);
      try {
        const fullEmail = `${cleanEmailPrefix}@mhs.uinjkt.ac.id`;
        const match = await onLookupRoster(cleanNim, fullEmail);
        setFullName(match.name);
        setRosterVerified(true);
        setError(null);
      } catch {
        setFullName('');
        setRosterVerified(false);
      } finally {
        setCheckingRoster(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [nim, emailName, isRegistering, onLookupRoster]);

  const handleManualVerifyRoster = async () => {
    setError(null);
    const cleanNim = nim.trim();
    const cleanEmailPrefix = emailName.trim();

    if (!/^\d+$/.test(cleanNim)) {
      setError('NIM must contain numbers only.');
      return;
    }
    if (!cleanEmailPrefix) {
      setError('Please enter your institutional email prefix.');
      return;
    }

    setCheckingRoster(true);
    try {
      const fullEmail = `${cleanEmailPrefix}@mhs.uinjkt.ac.id`;
      const match = await onLookupRoster(cleanNim, fullEmail);
      setFullName(match.name);
      setRosterVerified(true);
      setError(null);
    } catch (err) {
      setFullName('');
      setRosterVerified(false);
      setError(err.message);
    } finally {
      setCheckingRoster(false);
    }
  };

  const handleForgotPassword = async () => {
    const value = identifier.trim();
    if (!value) {
      setError('Enter your Student ID (NIM) or email first.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await onForgotPassword(value);
      setSuccessMsg('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err.message.includes('not registered') ? err.message : 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isRegistering) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
      if (!passwordRegex.test(password)) {
        setError('Password must be at least 6 characters and include at least 1 uppercase letter and 1 number. Symbols are not allowed.');
        return;
      }
      
      if (!/^\d+$/.test(nim.trim())) {
        setError('NIM must contain numbers only.');
        return;
      }

      if (!emailName.trim()) {
        setError('Email field is required.');
        return;
      }

      if (!rosterVerified || !fullName) {
        setError('Your NIM and Email must match the official class roster before registering.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const constructedEmail = `${emailName.trim().toLowerCase()}@mhs.uinjkt.ac.id`;
        await onRegister(constructedEmail, password, fullName, role, nim.trim());
      } else {
        await onLogin(identifier.trim(), password, role);
      }
    } catch (err) {
      console.error("Auth action error:", err);
      let msg = err.message;
      if (msg.includes('Verification email sent')) {
        setSuccessMsg('Verification email sent. Please check your inbox and verify your email before signing in.');
        setIsRegistering(false);
        return;
      } else if (msg.includes('Please verify your email')) {
        msg = 'Please verify your email before signing in. Check your inbox for the verification link.';
      } else if (msg.includes('invalid-credential') || msg.includes('user-not-found') || msg.includes('wrong-password')) {
        msg = 'Incorrect password.';
      } else if (msg.includes('already registered') || msg.includes('email-already-in-use')) {
        msg = 'This Student ID (NIM) or email is already in use.';
      } else if (msg.includes('weak-password')) {
        msg = 'Password must be at least 6 characters with 1 uppercase letter and 1 number.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-between bg-cover bg-center relative font-sans text-white overflow-x-hidden backdrop-blur-sm"
      style={{ backgroundImage: `url(${bgLogin})` }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[4px]"></div>

      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-center px-6 lg:px-12 py-8 gap-8 lg:gap-16 my-auto max-w-7xl mx-auto w-full">
        
        {/* Left Side: Branding */}
        <div className="max-w-xl space-y-6 text-center lg:text-left">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="w-24 h-24 lg:w-28 lg:h-28 bg-white rounded-2xl p-2 shadow-xl flex items-center justify-center shrink-0">
              <img src={uinLogo} alt="UIN Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow-md">
                AdaptLearn
              </h1>
              <p className="text-blue-200 text-lg lg:text-xl font-medium mt-1">
                Learning Behavior Modeling System
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-lg text-slate-100 text-sm lg:text-base leading-relaxed">
           "AdaptLearn is an adaptive, gamified learning platform engineered to help students build consistent study habits, complete tasks early, and stay on track through smart focus sessions and real-time progress tracking."
          </div>
        </div>

        {/* Right Side: Login / Register Card */}
        <div className="w-full max-w-md bg-white rounded-3xl p-8 lg:p-10 text-slate-900 shadow-2xl relative">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isRegistering ? 'Create Account' : 'Sign In'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isRegistering ? 'Verify your NIM & UIN email against the class roster' : 'Enter your credentials to access the portal'}
            </p>
          </div>

          {/* Role Toggle Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setRole('student'); setError(null); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                role === 'student' 
                  ? 'bg-[#0057D9] text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen size={18} />
              <span>Student</span>
            </button>
            <button
              type="button"
              disabled={isRegistering}
              onClick={() => { setRole('lecturer'); setError(null); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                role === 'lecturer' 
                  ? 'bg-[#0057D9] text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ShieldCheck size={18} />
              <span>Lecturer</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Student ID (NIM)</label>
                  <input
                    type="text"
                    required
                    value={nim}
                    onChange={e => setNim(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057D9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Institutional Email</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={emailName}
                      onChange={e => setEmailName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057D9]"
                    />
                    <span className="text-slate-500 text-xs sm:text-sm whitespace-nowrap">@mhs.uinjkt.ac.id</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-600">
                      Official Full Name
                    </label>
                    {rosterVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 size={13} /> Roster Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleManualVerifyRoster}
                        disabled={checkingRoster}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0057D9] hover:underline disabled:opacity-50"
                      >
                        <Search size={12} /> {checkingRoster ? 'Checking...' : 'Check Roster'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      required
                      value={fullName}
                      placeholder={checkingRoster ? 'Verifying class roster...' : 'Auto-filled from official class roster'}
                      className={`w-full px-4 py-3 pr-10 border rounded-2xl text-sm font-semibold cursor-not-allowed focus:outline-none ${
                        rosterVerified
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    />
                    <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 pointer-events-none">
                      <Lock size={15} />
                    </span>
                  </div>
                </div>
              </>
            )}

            {!isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {role === 'student' ? 'Student ID (NIM) or Email' : 'Email'}
                </label>
                <input type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Password
                </label>
                {!isRegistering && (
                  <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-[#0057D9] hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057D9] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {isRegistering && (
                  <p className="mt-2 text-xs text-slate-500">
                    Password must include at least 1 uppercase letter and 1 number.
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (isRegistering && !rosterVerified)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 bg-[#0057D9] hover:bg-[#0047B3] text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Processing...' : (isRegistering ? `Register as ${role === 'student' ? 'Student' : 'Lecturer'}` : `Sign In as ${role === 'student' ? 'Student' : 'Lecturer'}`)}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
            {isRegistering ? (
              <>
                Already have an account?{' '}
                <button onClick={() => { setIsRegistering(false); setError(null); }} className="font-semibold text-[#0057D9] hover:underline focus:outline-none">
                  Sign In
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button onClick={() => { setIsRegistering(true); setError(null); }} className="font-semibold text-[#0057D9] hover:underline focus:outline-none">
                  Register here
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 bg-[#0F1B4C]/90 border-t border-white/10 text-center text-xs text-blue-200">
        © 2026 AdaptLearn Platform — Learning Behavior Modeling System
      </footer>

    </div>
  );
}