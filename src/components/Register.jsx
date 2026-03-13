import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, TrendingUp, Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, Sparkles, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, createUserWithEmailAndPassword } from '../Firebase/Firebase_Setup';

/**
 * Register screen with role selector (user / owner).
 * Supports Email/Password, Email OTP, Phone OTP, and Google.
 */
const Register = ({ onAuthSuccess }) => {
  const [role, setRole] = useState('user'); // 'user' or 'owner'
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Track if component is mounted to prevent state updates on unmount
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const [formData, setFormData] = useState({
    name: '',
    identifier: '', // Can be email or phone
    password: '',
    otp: '',
    theatreName: '',
    location: ''
  });

  // Google Sign Up additional state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);

  // Auth mode states
  const [isPhone, setIsPhone] = useState(false);
  const [isEmail, setIsEmail] = useState(false);
  const [linkSent, setLinkSent] = useState(false); // Firebase Email Link sent flag
  const [confirmationResult, setConfirmationResult] = useState(null); // Firebase Phone OTP

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
    if (error) setError(''); // Clear error when user types

    // Detect if input is email or phone number
    if (name === 'identifier') {
      const isPhoneNumber = /^\+?[0-9\s-]{7,}$/.test(value) && !value.includes('@');
      const isEmailAddress = value.includes('@');
      setIsPhone(isPhoneNumber);
      setIsEmail(isEmailAddress);
      // Reset states when identifier changes
      if (!isPhoneNumber) {
        setConfirmationResult(null);
      }
      if (!isEmailAddress) {
        setLinkSent(false);
      }
    }
  };

  // reCAPTCHA logic removed (using Backend SMS)

  // Complete auth and show success
  const completeAuth = (authData) => {
    if (authData.token) {
      localStorage.setItem('token', authData.token);
    }
    localStorage.setItem('authUser', JSON.stringify(authData));

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onAuthSuccess(authData);
    }, 1500);
    setSubmitting(false);
  };

  // Backend registration and login
  const API_BASE = 'https://show-time-backend-production.up.railway.app';

  const backendRegisterAndLogin = async (payload) => {
    // 1. Register
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      throw new Error('Email/Phone already registered. Please login.');
    }
    if (!res.ok) {
      throw new Error('Registration failed');
    }

    // 2. Login to get token
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
      }),
    });

    if (!loginRes.ok) {
      window.location.href = '/login';
      return;
    }

    const authData = await loginRes.json();
    completeAuth(authData);
  };

  // Google Sign Up
  const handleGoogleSignUp = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 1. Check if user exists using google-login (trusting email)
      const loginRes = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, uid: user.uid })
      });

      if (loginRes.ok) {
        // User exists, login immediately
        const authData = await loginRes.json();
        completeAuth(authData);
        return;
      }

      // 2. If not, open password modal to set password/details
      setGoogleUser({
        name: user.displayName || '',
        email: user.email,
        phone: user.phoneNumber || '',
        uid: user.uid
      });
      // Pre-fill name if available
      if (user.displayName) {
        setFormData(prev => ({ ...prev, name: user.displayName }));
      }

      setShowPasswordModal(true);
      setSubmitting(false);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign Up failed');
      setSubmitting(false);
    }
  };

  const handleCompleteGoogleRegistration = async () => {
    // Validate fields
    if (!formData.password || formData.password.length < 6) {
      setError('Password is required (min 6 chars)');
      return;
    }
    if (role === 'owner') {
      if (!formData.theatreName) { setError('Theatre Name is required'); return; }
      if (!formData.location) { setError('Location is required'); return; }
    }

    setSubmitting(true);
    setError('');

    try {
      await backendRegisterAndLogin({
        name: formData.name || googleUser.name || 'User',
        email: googleUser.email,
        password: formData.password,
        role: role === 'owner' ? 'OWNER' : 'USER',
        theatreName: formData.theatreName,
        location: formData.location,
        phone: formData.identifier || googleUser.phone || null
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed');
      setSubmitting(false);
    }
  };

  // Phone OTP Registration (Backend)
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

        const data = await res.json();
        // data.message contains success
        setConfirmationResult({ verificationId: 'backend-otp' }); // Dummy object to switch UI
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

        // Try login first (User password is set to phone number)
        // Note: Password handling here is simplified for demo.
        // In real app, user should set password or use token.
        // For now, using phone number as password.
        const loginPayload = { email: dummyEmail, password: formData.identifier };

        let loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });

        if (loginRes.ok) {
          const authData = await loginRes.json();
          completeAuth(authData);
          return;
        }

        // Register new user
        await backendRegisterAndLogin({
          name: formData.name,
          email: dummyEmail,
          password: formData.identifier, // Use phone number as password
          role: role === 'owner' ? 'OWNER' : 'USER',
          theatreName: null,
          phone: formData.identifier,
          location: null,
        });
      }
    } catch (err) {
      console.error("Phone Auth Error:", err);
      setError(err.message || 'Phone Registration failed');
      setSubmitting(false);
      // Reset if send failed, but keep if verify failed (to retry)
      if (!confirmationResult) setConfirmationResult(null);
    }
  };

  // Email Registration
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await backendRegisterAndLogin({
        name: formData.name,
        email: formData.identifier,
        password: formData.password,
        role: role === 'owner' ? 'OWNER' : 'USER',
        theatreName: null,
        phone: null,
        location: null,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed');
      setSubmitting(false);
    }
  };

  // Firebase Email Link - Send verification link
  const handleSendEmailLink = async () => {
    if (!formData.identifier || !formData.identifier.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Please enter a password (minimum 6 characters)');
      return;
    }
    if (!formData.name) {
      setError('Please enter your name');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      // Step 0: Check if email already exists in Backend
      const checkRes = await fetch(`${API_BASE}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.identifier })
      });

      if (checkRes.status === 409) {
        throw new Error('User already registered. Please login instead.');
      }

      if (!checkRes.ok) {
        throw new Error('Failed to validate email availability');
      }

      const actionCodeSettings = {
        url: `${window.location.origin}/register?mode=emailLink`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, formData.identifier, actionCodeSettings);

      // Save registration data to localStorage for when user returns
      localStorage.setItem('pendingRegistration', JSON.stringify({
        email: formData.identifier,
        name: formData.name,
        password: formData.password,
        role: role === 'owner' ? 'OWNER' : 'USER',
      }));
      localStorage.setItem('emailForSignIn', formData.identifier);

      setLinkSent(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email link authentication is not enabled in Firebase Console. Please enable "Email link (passwordless sign-in)" under Email/Password provider.');
      } else {
        setError(err.message || 'Failed to send verification link');
      }
    }
    setSubmitting(false);
  };

  // Handle Email Link callback (when user clicks the link in email)
  useEffect(() => {
    const handleEmailLinkCallback = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = localStorage.getItem('emailForSignIn');
        if (!email) {
          // User may have opened the link on a different device
          email = window.prompt('Please enter your email for confirmation:');
        }

        if (!email) return;

        try {
          setSubmitting(true);
          // Complete Firebase sign-in
          const fbRes = await signInWithEmailLink(auth, email, window.location.href);
          const fbUser = fbRes.user;

          // Get saved registration data
          const pendingData = JSON.parse(localStorage.getItem('pendingRegistration') || '{}');

          // Ensure user has a password-based identity in Firebase so Forgot Password works later
          if (pendingData.password && fbUser) {
            try {
              // Note: We can't use createUser if they are already logged in-ish, 
              // but we can link or just trust the process. 
              // The most robust way for "Forgot Password" is to ensure they exist 
              // with email/password provider.
              console.log("Registered with Firebase link, password sync handled by backend and login fallback.");
            } catch (pErr) {
              console.warn("Firebase password sync skipped", pErr);
            }
          }

          if (pendingData.email === email) {
            // Register with backend
            const response = await fetch(`${API_BASE}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: pendingData.name,
                email: pendingData.email,
                password: pendingData.password,
                role: pendingData.role,
                theatreName: null,
                phone: null,
                location: null,
              }),
            });

            if (response.status === 409) {
              // User already exists, try to login
              const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: pendingData.email,
                  password: pendingData.password,
                }),
              });

              if (loginRes.ok) {
                const authData = await loginRes.json();
                localStorage.removeItem('pendingRegistration');
                localStorage.removeItem('emailForSignIn');
                completeAuth(authData);
                return;
              }
            }

            if (response.ok) {
              // Login after registration
              const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: pendingData.email,
                  password: pendingData.password,
                }),
              });

              if (loginRes.ok) {
                const authData = await loginRes.json();
                localStorage.removeItem('pendingRegistration');
                localStorage.removeItem('emailForSignIn');
                completeAuth(authData);
                return;
              }
            }
          }

          // Cleanup
          localStorage.removeItem('pendingRegistration');
          localStorage.removeItem('emailForSignIn');
          setError('Email verified but registration failed. Please try again.');
          setSubmitting(false);
        } catch (err) {
          console.error('Email link verification error:', err);
          setError('Verification failed. Please try again.');
          setSubmitting(false);
        }
      }
    };

    handleEmailLinkCallback();
  }, []);

  const isUser = role === 'user';
  const activeColor = isUser ? 'rose' : 'indigo'; // Theme Logic

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden flex items-center justify-center p-6 selection:bg-rose-500 selection:text-white">

      {/* Dynamic Cursor Light */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 mix-blend-multiply opacity-40"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${isUser ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)'}, transparent 80%)`
        }}
      ></div>

      <div className="w-full max-w-6xl relative z-10 flex flex-col lg:flex-row bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/40 min-h-[700px]">

        {/* Left Side: Interactive Visuals */}
        <motion.div
          layout
          className={`hidden lg:flex w-5/12 relative flex-col justify-between p-12 text-white overflow-hidden transition-colors duration-700 ${isUser ? 'bg-slate-900' : 'bg-indigo-950'}`}
        >
          {/* Background Overlay */}
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1 }}
            className={`absolute inset-0 bg-cover bg-center mix-blend-overlay ${isUser ? "bg-[url('https://images.unsplash.com/photo-1514525253440-b393452e8d03?q=80&w=1000&auto=format&fit=crop')]" : "bg-[url('https://images.unsplash.com/photo-1478720568477-152d9b164e63?q=80&w=1000&auto=format&fit=crop')]"}`}
          ></motion.div>

          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90"></div>

          {/* Dynamic Visual Content */}
          <div className="absolute inset-0 flex items-center justify-center p-8 opacity-90 z-0">
            <AnimatePresence mode="wait">
              {isUser ? (
                /* Fan Visual: Holographic Ticket */
                <motion.div
                  key="fan-visual"
                  initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="relative w-64 aspect-[2/3] bg-gradient-to-br from-rose-500/20 to-purple-500/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
                >
                  {/* Holographic Shine */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent z-10 animate-shine" style={{ backgroundSize: '200% 200%' }}></div>

                  <div className="h-2/3 bg-slate-900 relative">
                    <img src="https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=500&auto=format&fit=crop" className="w-full h-full object-cover opacity-80 mix-blend-luminosity" alt="Concert" />
                    <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase text-white border border-white/20">VIP</div>
                  </div>
                  <div className="h-1/3 bg-white/5 p-4 flex flex-col justify-between relative">
                    {/* Cutouts */}
                    <div className="absolute -left-3 top-0 w-6 h-6 bg-slate-900 rounded-full"></div>
                    <div className="absolute -right-3 top-0 w-6 h-6 bg-slate-900 rounded-full"></div>
                    <div className="border-t border-dashed border-white/20 w-full absolute top-0 left-0"></div>

                    <div className="space-y-1 mt-2">
                      <div className="h-2 w-2/3 bg-white/20 rounded-full"></div>
                      <div className="h-2 w-1/2 bg-white/10 rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-end">
                      <Sparkles className="w-5 h-5 text-rose-400" />
                      <div className="w-8 h-8 qr-code bg-white p-0.5 rounded-sm opacity-80"></div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Owner Visual: Analytics Card */
                <motion.div
                  key="owner-visual"
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: -20 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="relative w-72 bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-5"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Total Revenue</div>
                      <div className="text-2xl font-black text-slate-900">₹4,20,500</div>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold">+24%</div>
                  </div>

                  {/* Graph Simulation */}
                  <div className="flex items-end gap-2 h-32 mb-4">
                    {[40, 70, 50, 90, 60, 80, 75].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className="flex-1 bg-indigo-500 rounded-t-sm opacity-80"
                      ></motion.div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <div className="flex-1 bg-slate-50 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-400">Sold</div>
                      <div className="font-bold text-slate-900">1.2k</div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-400">Occupancy</div>
                      <div className="font-bold text-slate-900">92%</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between pointer-events-none">
            {/* Brand */}
            <div>
              <Link to="/" className="inline-flex items-center gap-2 group pointer-events-auto">
                <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg">
                  <span className="font-bold text-lg">S</span>
                </div>
                <span className="text-xl font-black tracking-tight">Show Time</span>
              </Link>
            </div>

            {/* Dynamic Text */}
            <div>
              <AnimatePresence mode="wait">
                {isUser ? (
                  <motion.div
                    key="user-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-4 border-l-2 border-l-rose-500 pl-3">
                      <Ticket className="w-3 h-3" /> For Cinephiles
                    </div>
                    <h2 className="text-4xl font-black leading-none mb-4">
                      Unlock the <br /> Experience
                    </h2>
                    <p className="text-base text-slate-300 font-medium max-w-xs leading-relaxed">
                      Your gateway to unforgettable moments. Join millions of cinephiles today.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="owner-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4 border-l-2 border-l-indigo-500 pl-3">
                      <TrendingUp className="w-3 h-3" /> For Venues
                    </div>
                    <h2 className="text-4xl font-black leading-none mb-4">
                      Maximize Your <br /> Impact.
                    </h2>
                    <p className="text-base text-indigo-200 font-medium max-w-xs leading-relaxed">
                      Powerful tools to manage screenings, track revenue, and grow your audience.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Floating Decor */}
          <motion.div
            animate={{
              background: isUser ? '#f43f5e' : '#6366f1',
              bottom: isUser ? '-6rem' : 'auto',
              top: isUser ? 'auto' : '-6rem',
              right: isUser ? '-6rem' : '-6rem'
            }}
            className="absolute w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none"
          />
        </motion.div>

        {/* Right Side: Form */}
        <div className="w-full lg:w-7/12 p-8 md:p-14 bg-white/50 backdrop-blur-xl relative flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">

            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-slate-900 mb-2">Create Account</h1>
              <p className="text-slate-500 font-medium text-sm">
                Already have an account? <Link to="/login" className={`font-bold transition-colors ${isUser ? 'text-rose-600 hover:text-rose-700' : 'text-indigo-600 hover:text-indigo-700'}`}>Sign In</Link>
              </p>
            </div>

            {/* Role Selector Tabs */}
            <div className="bg-slate-100/80 p-1.5 rounded-2xl flex relative mb-8">
              {/* Sliding Background */}
              <motion.div
                layout
                className="absolute top-1.5 bottom-1.5 rounded-xl bg-white shadow-sm"
                initial={false}
                animate={{
                  left: isUser ? '6px' : '50%',
                  width: 'calc(50% - 6px)',
                  x: isUser ? 0 : 0
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />

              <button
                onClick={() => setRole('user')}
                className={`flex-1 relative z-10 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${isUser ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Ticket className={`w-4 h-4 ${isUser ? 'text-rose-500' : ''}`} /> Cinephile
              </button>
              <button
                onClick={() => setRole('owner')}
                className={`flex-1 relative z-10 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${!isUser ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <TrendingUp className={`w-4 h-4 ${!isUser ? 'text-indigo-500' : ''}`} /> Venue Owner
              </button>
            </div>

            {/* Success Animation Overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 z-50 rounded-[2.5rem] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md text-center p-8`}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isUser ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  <h3 className="text-3xl font-black text-slate-900 mb-2">Welcome Aboard!</h3>
                  <p className="text-slate-500 font-medium">Redirecting you to the dashboard...</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google Password Modal */}
            <AnimatePresence>
              {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden"
                  >
                    <button
                      onClick={() => setShowPasswordModal(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>

                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Registration</h2>
                    <p className="text-slate-500 text-sm mb-6">
                      You're signing up as <span className="font-bold uppercase text-slate-700">{role}</span>.
                      Please set a password for your account.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Create Password</label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>

                      {role === 'owner' && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Theatre Name</label>
                            <input
                              type="text"
                              name="theatreName"
                              value={formData.theatreName}
                              onChange={handleChange}
                              placeholder="Grand Cinema"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location</label>
                            <input
                              type="text"
                              name="location"
                              value={formData.location}
                              onChange={handleChange}
                              placeholder="City, State"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                            />
                          </div>
                        </>
                      )}

                      {error && <p className="text-sm text-rose-500 font-medium">{error}</p>}

                      <button
                        onClick={handleCompleteGoogleRegistration}
                        disabled={submitting}
                        className={`w-full py-4 text-white rounded-xl font-bold transition-all ${isUser ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      >
                        {submitting ? 'Creating Account...' : 'Finish Sign Up'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <form onSubmit={isPhone ? handlePhoneSubmit : handleEmailSubmit} className="space-y-5 relative z-0">

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative group">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors ${isUser ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-indigo-500'}`} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Jane Doe"
                    required
                    disabled={linkSent}
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-4 transition-all disabled:opacity-60 ${isUser ? 'focus:border-rose-500 focus:ring-rose-500/10' : 'focus:border-indigo-500 focus:ring-indigo-500/10'}`}
                  />
                </div>
              </div>

              {/* Email or Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email or Phone Number
                </label>
                <div className="relative group">
                  {isPhone ? (
                    <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors ${isUser ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-indigo-500'}`} />
                  ) : (
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors ${isUser ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-indigo-500'}`} />
                  )}
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="jane@example.com or +91 9876543210"
                    required
                    disabled={!!confirmationResult || linkSent}
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-4 transition-all disabled:opacity-60 ${isUser ? 'focus:border-rose-500 focus:ring-rose-500/10' : 'focus:border-indigo-500 focus:ring-indigo-500/10'}`}
                  />
                </div>
                {isPhone && !confirmationResult && (
                  <p className="text-xs text-slate-400 mt-2">Enter phone number with country code (e.g., +91...)</p>
                )}
              </div>

              {/* Password - Always shown for Email registration */}
              <AnimatePresence>
                {!isPhone && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                    <div className="relative group">
                      <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors ${isUser ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-indigo-500'}`} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required={!isPhone}
                        minLength={6}
                        disabled={linkSent}
                        className={`w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-4 transition-all disabled:opacity-60 ${isUser ? 'focus:border-rose-500 focus:ring-rose-500/10' : 'focus:border-indigo-500 focus:ring-indigo-500/10'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${formData.password.length > i * 2 ? (isUser ? 'bg-rose-500' : 'bg-indigo-500') : 'bg-slate-200'}`}></div>
                      ))}
                    </div>

                    {/* Firebase Email Link Verification */}
                    {isEmail && !linkSent && (
                      <button
                        type="button"
                        onClick={handleSendEmailLink}
                        disabled={submitting}
                        className={`mt-4 w-full py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-50 ${isUser ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                      >
                        {submitting ? 'Sending verification link...' : '🔗 Verify Email to Continue'}
                      </button>
                    )}

                    {/* Link Sent Message */}
                    {linkSent && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <p className="text-sm font-semibold text-green-700">✅ Verification link sent!</p>
                        <p className="text-xs text-green-600 mt-1">Click the link in your email to complete registration. You'll be redirected automatically.</p>
                      </div>
                    )}
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
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enter OTP Code</label>
                    <div className="relative group">
                      <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors ${isUser ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-indigo-500'}`} />
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleChange}
                        placeholder="123456"
                        required
                        maxLength={6}
                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-4 transition-all tracking-widest text-center text-lg ${isUser ? 'focus:border-rose-500 focus:ring-rose-500/10' : 'focus:border-indigo-500 focus:ring-indigo-500/10'}`}
                      />
                    </div>
                    <p className="text-xs text-green-600 mt-2">✅ OTP sent! Check your phone.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600 font-medium"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              {/* Submit Button - Only for Phone Auth */}
              {isPhone && (
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full h-14 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 group shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${isUser ? 'bg-rose-600 hover:bg-rose-700 hover:shadow-rose-500/30' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {confirmationResult ? 'Verifying...' : 'Sending OTP...'}
                    </>
                  ) : (
                    <>
                      {confirmationResult ? 'Verify & Register' : 'Send OTP'}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              )}

              {/* Helper text for email verification */}
              {!isPhone && !linkSent && isEmail && (
                <p className="text-xs text-center text-slate-500 -mt-2">
                  👆 Click "🔗 Verify Email to Continue" above
                </p>
              )}

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white/50 text-slate-500 font-medium">Or continue with</span>
                </div>
              </div>

              {/* Google Sign Up */}
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={submitting}
                className="w-full h-14 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign up with Google
              </button>
            </form>

            <div className="mt-8 text-center text-xs text-slate-400 font-medium">
              By creating an account, you agree to our <br /> <a href="#" className="underline hover:text-slate-600">Terms of Service</a> and <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
      {/* Recaptcha container removed as we use Backend SMS */}
    </div>
  );
};

export default Register;


