import React, { useState } from 'react';
import { BookOpen, ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, Mail } from 'lucide-react';
import uinLogo from './assets/uin_logo.jpg';
import bgLogin from './assets/bg-login.webp';

export function LoginView({ onLogin, onRegister, onForgotPassword }) {
  const [role, setRole] = useState('student');
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [nim, setNim] = useState('');
  const [emailName, setEmailName] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleForgotPassword = async () => {
    const value = identifier.trim();
    if (!value) {
      setError('Enter your Student ID (NIM) or email first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onForgotPassword(value);
      setError('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err.message.includes('not registered') ? err.message : 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Password Validation for Registration
    if (isRegistering) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/;
      if (!passwordRegex.test(password)) {
        setError('Password must be at least 6 characters and include at least 1 uppercase letter and 1 number.');
        return;
      }
      
      if (!/^\d+$/.test(nim)) {
        setError('NIM harus berupa angka.');
        return;
      }

      if (!emailName.trim()) {
        setError('Bagian email wajib diisi.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const constructedEmail = `${emailName.trim()}@mhs.uinjkt.ac.id`;
        await onRegister(constructedEmail, password, fullName, role, nim.trim());
      } else {
        await onLogin(identifier.trim(), password, role);
      }
    } catch (err) {
      console.error("Auth action error:", err);
      let msg = err.message;
      if (msg.includes('invalid-credential') || msg.includes('user-not-found') || msg.includes('wrong-password')) {
        msg = 'Student ID (NIM) or email is not registered, or the password is incorrect.';
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
            AdaptLearn is an AI-driven adaptive learning analytics platform for higher education. It continuously captures student digital footprints, applies machine-learning clustering to build personalized learning personas, and proactively identifies academic-risk indicators in real time. Educators gain actionable dashboards, automated alerts, and assignment management tools; students receive personalized study plans, gamified progress tracking, and instant feedback — all within a secure, privacy-first ecosystem.
          </div>
        </div>

        {/* Right Side: Login / Register Card */}
        <div className="w-full max-w-md bg-white rounded-3xl p-8 lg:p-10 text-slate-900 shadow-2xl relative">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isRegistering ? 'Create Account' : 'Sign In'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isRegistering ? 'Register new account to access the portal' : 'Enter your credentials to access the portal'}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057D9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Student ID (NIM)</label>
                  <input type="text" required value={nim} onChange={e => setNim(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057D9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <div className="flex items-center gap-2">
                    <input type="text" required value={emailName} onChange={e => setEmailName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057D9]" placeholder="name" />
                    <span className="text-slate-500 text-sm whitespace-nowrap">@mhs.uinjkt.ac.id</span>
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
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 bg-[#0057D9] hover:bg-[#0047B3] text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-base disabled:opacity-50"
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
                  Sign In here
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
