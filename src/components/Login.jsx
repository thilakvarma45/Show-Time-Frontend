import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword } from '../Firebase/Firebase_Setup';

/**
 * Login screen.
 * Supports Email/Password, Email OTP, Phone OTP, and Google.
 */
const Login = ({ onAuthSuccess }) => {
  const [formData, setFormData] = useState({ identifier: '', password: '', otp: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Auth mode states
  const [isPhone, setIsPhone] = useState(false);
  const [isEmail, setIsEmail] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const API_BASE = 'https://show-time-backend-production.up.railway.app';

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');

    // Detect if input is email or phone number
    if (name === 'identifier') {
      const isPhoneNumber = /^\+?[0-9\s-]{7,}$/.test(value) && !value.includes('@');
      const isEmailAddress = value.includes('@');
      setIsPhone(isPhoneNumber);
      setIsEmail(isEmailAddress);
      // Reset OTP states when identifier changes
      if (!isPhoneNumber) {
        setConfirmationResult(null);
      }
    }
  };

  // reCAPTCHA logic removed (using Backend SMS)

  // Backend sync for social/phone login
  const backendSocialAuth = async (email, uid, name = '', phone = '') => {
    const loginPayload = { email, password: uid };

    try {
      // Try google-login first (Passwordless / Trusted)
      let res = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, uid }),
      });

      if (res.status === 404) {
        throw new Error('Account does not exist. Please Create an Account first.');
      }

      if (!res.ok) throw new Error('Backend sync failed');
      return await res.json();
    } catch (err) {
      throw err;
    }
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const authData = await backendSocialAuth(user.email, user.uid, user.displayName);
      completeLogin(authData);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign In failed');
      setSubmitting(false);
    }
  };

  // Phone OTP Flow (Backend)
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!confirmationResult) {
        // Step 1: Send OTP via Backend
        const res = await fetch(`${API_BASE}/api/auth/send-sms-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formData.identifier })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to send OTP');
        }

        setConfirmationResult({ verificationId: 'backend-otp' });
        setSubmitting(false);
      } else {
        // Step 2: Verify OTP via Backend
        const res = await fetch(`${API_BASE}/api/auth/verify-sms-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formData.identifier, otp: formData.otp })
        });

        if (!res.ok) {
          throw new Error('Invalid OTP');
        }

        const sanePhone = formData.identifier.replace('+', '');
        const dummyEmail = `${sanePhone}@phone.showtime.com`;

        // Try login using phone number as password
        const loginPayload = { email: dummyEmail, password: formData.identifier };
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });

        if (!loginRes.ok) {
          throw new Error('User not found. Please register first.');
        }

        const authData = await loginRes.json();
        completeLogin(authData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Phone Authentication failed');
      setSubmitting(false);
      if (!confirmationResult) setConfirmationResult(null);
    }
  };

  // Email/Password Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // 1. Try Firebase Login First (Source of Truth for Password Resets)
      let firebaseUser = null;
      try {
        const fbResult = await signInWithEmailAndPassword(auth, formData.identifier, formData.password);
        firebaseUser = fbResult.user;
      } catch (fbErr) {
        // Correct password handling: If Firebase rejects it, it's definitely wrong.
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          throw new Error('Invalid email or password');
        }
        // For other errors (e.g. user-not-found), log silently and fallback to DB
        // console.log("Firebase check skipped:", fbErr.code);
      }

      if (firebaseUser) {
        // 2. Sync with Backend (Trusting Firebase)
        const authData = await backendSocialAuth(firebaseUser.email, firebaseUser.uid);
        completeLogin(authData);
        return;
      }

      // 3. Fallback: Traditional Local Login
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.identifier,
          password: formData.password,
        }),
      });
      if (!res.ok) {
        throw new Error('Invalid email or password');
      }
      const user = await res.json();
      completeLogin(user);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed');
      setSubmitting(false);
    }
  };

  // Forgot Password Handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setResetSent(true);
      setTimeout(() => {
        setResetSent(false);
        setShowForgotModal(false);
        setForgotEmail('');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to send reset email. Make sure the email is correct.');
    } finally {
      setSubmitting(false);
    }
  };



  const completeLogin = (user) => {
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    }
    if (user.token) {
      localStorage.setItem('token', user.token);
    }
    localStorage.setItem('authUser', JSON.stringify(user));
    onAuthSuccess(user);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden flex items-center justify-center p-6 selection:bg-rose-500 selection:text-white">

      {/* Dynamic Cursor Light */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 mix-blend-multiply opacity-40"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(244,63,94,0.15), transparent 80%)`
        }}
      ></div>

      {/* Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-gradient-to-br from-rose-50 to-indigo-50 rounded-bl-[10rem] -z-10 opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-slate-50 rounded-tr-[10rem] -z-10"></div>
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col md:flex-row bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/40">

        {/* Left Side: Visual */}
        <div className="hidden md:flex w-1/2 bg-slate-900 relative flex-col justify-between p-12 text-white overflow-hidden group">
          {/* Abstract Background */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900"></div>

          {/* Floating Posters Layer - Behind Text */}
          <div className="absolute inset-0 z-0 opacity-60">
            {/* Poster 1 */}
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [6, 12, 6] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-20 right-[-40px] w-48 h-72 rounded-xl shadow-2xl border-4 border-white/5 overflow-hidden transform rotate-6"
            >
              <img src="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=500&auto=format&fit=crop" className="w-full h-full object-cover" alt="Concert" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            </motion.div>

            {/* Poster 2 */}
            <motion.div
              animate={{ y: [0, 20, 0], rotate: [-6, 0, -6] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-40 -left-10 w-40 h-60 rounded-xl shadow-2xl border-4 border-white/5 overflow-hidden transform -rotate-6"
            >
              <img src="https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=500&auto=format&fit=crop" className="w-full h-full object-cover" alt="Movie" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            </motion.div>

            {/* Golden Ticket */}
            <motion.div
              animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 w-64 h-32 bg-gradient-to-r from-yellow-500 via-amber-200 to-yellow-500 rounded-lg shadow-[0_0_50px_rgba(234,179,8,0.3)] flex items-center justify-between p-4 border border-white/20"
            >
              <div className="border-r-2 border-dashed border-black/20 h-full pr-4 flex items-center justify-center">
                <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                  <span className="font-black text-black/50 text-xl">ST</span>
                </div>
              </div>
              <div className="flex-1 pl-4">
                <div className="text-[10px] font-bold text-black/50 uppercase tracking-widest">Admit One</div>
                <div className="text-2xl font-black text-black/80 tracking-tighter">PREMIUM</div>
                <div className="flex gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-black/20"></div>
                  <div className="w-2 h-2 rounded-full bg-black/20"></div>
                  <div className="w-10 h-2 rounded-full bg-black/10"></div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-2 group backdrop-blur-md bg-white/10 px-4 py-2 rounded-full border border-white/10 hover:bg-white/20 transition-all">
              <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-lg">S</span>
              </div>
              <span className="text-lg font-black tracking-tight">Show Time</span>
            </Link>
          </div>

          <div className="relative z-10 mt-auto backdrop-blur-sm bg-black/30 p-6 rounded-3xl border border-white/10">
            <h2 className="text-4xl font-black leading-tight mb-3">
              Welcome Back
            </h2>
            <p className="text-sm text-slate-200 font-medium leading-relaxed">
              "The cinema has no boundary; it is a ribbon of dream." <br /> <span className="text-slate-400 italic mt-1 block">- Orson Welles</span>
            </p>
          </div>

          {/* Decor */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white/50 backdrop-blur-xl">
          <div className="max-w-sm mx-auto w-full">
            {/* reCAPTCHA container for phone auth */}
            <div id="recaptcha-container"></div>

            <div className="text-center md:text-left mb-10">
              <h1 className="text-3xl font-black text-slate-900 mb-2">Sign In</h1>
              <p className="text-slate-500 font-medium text-sm">
                New user? <Link to="/register" className="text-rose-600 font-bold hover:text-rose-700 transition-colors">Create an account</Link>
              </p>
            </div>

            <form onSubmit={isPhone ? handlePhoneSubmit : handleEmailLogin} className="space-y-6">
              {/* Email or Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email or Phone Number
                </label>
                <div className="relative group">
                  {isPhone ? (
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                  ) : (
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                  )}
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="john@example.com or +91 9876543210"
                    required
                    disabled={!!confirmationResult}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all disabled:opacity-60"
                  />
                </div>
                {isPhone && !confirmationResult && (
                  <p className="text-xs text-slate-400 mt-2">Enter phone number with country code (e.g., +91...)</p>
                )}
              </div>

              {/* Password - Only shown for Email login */}
              <AnimatePresence>
                {!isPhone && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required={!isPhone}
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* OTP Input - Shown for Phone after OTP sent (Firebase Phone Auth) */}
              <AnimatePresence>
                {confirmationResult && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enter OTP</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleChange}
                        placeholder="123456"
                        required
                        maxLength={6}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all tracking-widest text-center text-lg"
                      />
                    </div>
                    <p className="text-xs text-green-600 mt-2">✅ OTP sent! Check your phone.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Remember Me */}
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-rose-500 border-rose-500' : 'border-slate-300 bg-white group-hover:border-rose-400'}`}>
                    {rememberMe && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                  </div>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="hidden"
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Keep me signed in</span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-sm text-rose-600 font-medium"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-rose-600 transition-all flex items-center justify-center gap-2 group shadow-xl hover:shadow-rose-500/20 hover:-translate-y-0.5"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isPhone
                      ? (confirmationResult ? 'Verifying...' : 'Sending OTP...')
                      : 'Signing In...'
                    }
                  </>
                ) : (
                  <>
                    {isPhone
                      ? (confirmationResult ? 'Verify OTP' : 'Send OTP')
                      : 'Sign In'
                    }
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white/50 text-slate-500 font-medium">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full h-14 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
              Protected by Show Time Security <br /> By logging in you agree to our Terms and Conditions.
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForgotModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></motion.div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -z-10"></div>

              <h2 className="text-2xl font-black text-slate-900 mb-2">Reset Password</h2>
              <p className="text-slate-500 text-sm mb-6 font-medium">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {resetSent ? (
                <div className="bg-green-50 border border-green-100 p-6 rounded-2xl text-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-green-500/20">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-green-800 font-bold text-lg mb-1">Email Sent!</h3>
                  <p className="text-green-600 text-sm font-medium">Check your inbox for the reset link.</p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-rose-600 transition-all disabled:opacity-50"
                    >
                      {submitting ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;


