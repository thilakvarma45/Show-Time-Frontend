import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Search } from 'lucide-react';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Users/Home';
import MovieDetails from './components/Users/MovieDetails';
import EventDetails from './components/Users/EventDetails';
import BookingLayout from './components/Movie/BookingLayout';
import EventBookingLayout from './components/Events/EventBookingLayout';
import OwnerDashboard from './components/Owner/OwnerDashboard';
import ProfileDropdown from './components/Users/ProfileDropdown';
import Settings from './components/Settings';
import MyBookings from './components/Users/MyBookings';
import Wishlist from './components/Users/Wishlist';
import TicketView from './components/Users/TicketView';
import HelpAndSupport from './components/Users/HelpAndSupport';

// Protected Route Component
const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Main App Content (with routing and state)
const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication state
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('authUser');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('token');
    // Avoid redirect loops when token exists but user payload is missing
    return Boolean(token && user);
  });

  // Main state management
  const [view, setView] = useState(() => {
    const role = (user?.role || '').toString().toUpperCase();
    return role === 'OWNER' ? 'OWNER_DASHBOARD' : 'HOME';
  });

  const [bookingType, setBookingType] = useState(() => {
    if (location.pathname.includes('/booking/event')) return 'EVENT';
    if (location.pathname.includes('/booking/movie')) return 'MOVIE';
    return 'MOVIE';
  });
  const [bookingStep, setBookingStep] = useState(1);

  // Movie state
  const [selectedMovie, setSelectedMovie] = useState(() => location.state?.movie || null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Event state
  const [selectedEvent, setSelectedEvent] = useState(() => location.state?.event || null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedZones, setSelectedZones] = useState({});

  // Shared state
  const [totalPrice, setTotalPrice] = useState(0);
  const [bookingId, setBookingId] = useState(null);
  const [bookingCode, setBookingCode] = useState(null);

  // Wishlist state
  const [wishlist, setWishlist] = useState([]);

  // Load wishlist from backend
  const API_BASE = 'https://show-time-backend-production.up.railway.app';

  useEffect(() => {
    if (user?.id) {
      const token = localStorage.getItem('token');
      fetch(`${API_BASE}/api/wishlist/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Failed");
        })
        .then((data) => {
          // Normalize data from backend entity to frontend model
          const normalized = data.map((item) => ({
            ...item,
            id: item.type === 'movie' ? Number(item.itemId) : item.itemId, // TMDB IDs are numbers
            genre: item.genre ? item.genre.split(', ') : [],
            // Ensure other fields map correctly if needed
          }));
          setWishlist(normalized);
        })
        .catch((err) => console.error('Failed to load wishlist', err));
    } else {
      setWishlist([]);
    }
  }, [user?.id]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Handlers: navigation and booking flows are identical to previous AppContent
  const handleMovieSelect = (movie) => {
    navigate(`/movie/${movie.id}`);
  };

  const handleBookNow = (movie) => {
    setSelectedMovie(movie);
    setSelectedEvent(null);
    setBookingType('MOVIE');
    setBookingStep(1);
    navigate('/booking/movie', { state: { movie } });
  };

  // Navigate to event details page
  const handleEventSelect = (eventSummary) => {
    navigate(`/event/${eventSummary.id}`);
  };

  // Book event from EventDetails page
  const handleEventBookNow = async (event) => {
    try {
      // Fetch full event details if not already complete
      const res = await fetch(`${API_BASE}/api/events/${event.id}`);
      if (!res.ok) {
        throw new Error('Failed to load event details');
      }
      const full = await res.json();
      let parsedConfig = {};
      try {
        parsedConfig = full.eventConfig ? JSON.parse(full.eventConfig) : {};
      } catch (e) {
        console.error('Failed to parse eventConfig', e);
        parsedConfig = {};
      }

      const normalizedEvent = {
        id: full.id,
        title: full.title,
        poster: full.posterUrl,
        venue: full.venue?.name || full.address || event.venue,
        address: full.address || event.address,
        dates: parsedConfig.dates || [],
        zones: parsedConfig.zones || [],
      };

      setSelectedEvent(normalizedEvent);
      setSelectedMovie(null);
      setBookingType('EVENT');
      setBookingStep(1);
      setBookingType('EVENT');
      setSelectedEvent(normalizedEvent);
      setBookingStep(1);
      navigate('/booking/event', { state: { event: normalizedEvent } });
    } catch (e) {
      console.error('Error loading full event', e);
    }
  };

  const handleBack = () => {
    const isOwner = (user?.role || '').toString().toUpperCase() === 'OWNER';
    if (isOwner) {
      setView('OWNER_DASHBOARD');
      navigate('/owner/dashboard');
    } else {
      setView('HOME');
      navigate('/home');
    }
    setSelectedMovie(null);
    setSelectedEvent(null);
    setSelectedShow(null);
    setSelectedDate(null);
    setSelectedSeats([]);
    setSelectedZones({});
    setTotalPrice(0);
    setBookingId(null);
    setBookingStep(1);
  };

  const handleNavigateHome = () => {
    const isOwner = (user?.role || '').toString().toUpperCase() === 'OWNER';
    if (isOwner) {
      setView('OWNER_DASHBOARD');
      navigate('/owner/dashboard');
    } else {
      setView('HOME');
      navigate('/home');
    }
  };

  const handleTimeSelect = (showDetails) => {
    setSelectedShow(showDetails);
    setBookingStep(2);
  };

  const handleSeatsSelect = (seats, price) => {
    setSelectedSeats(seats);
    setTotalPrice(price);
    setBookingStep(3);
  };

  const handleStepChange = (newStep) => {
    // If going back, clear subsequent step selections
    if (newStep < bookingStep) {
      if (newStep === 1) {
        // Going back to step 1 (theatres) - clear show selection
        setSelectedShow(null);
        setSelectedSeats([]);
        setTotalPrice(0);
        setBookingId(null);
      } else if (newStep === 2) {
        // Going back to step 2 (seats) - clear seat selection
        setSelectedSeats([]);
        setTotalPrice(0);
        setBookingId(null);
      } else if (newStep === 3) {
        // Going back to step 3 (payment) - clear booking ID
        setBookingId(null);
      }
    }
    setBookingStep(newStep);
  };

  const handleDateSelect = (dateDetails) => {
    setSelectedDate(dateDetails);
    setBookingStep(2);
  };

  const handleZonesSelect = (zones, price) => {
    setSelectedZones(zones);
    setTotalPrice(price);
    setBookingStep(3);
  };

  const handlePaymentComplete = async (paymentInfo) => {
    try {
      if (!user) return;

      const amountToCharge =
        typeof paymentInfo?.finalAmount === 'number' && Number.isFinite(paymentInfo.finalAmount)
          ? paymentInfo.finalAmount
          : totalPrice;

      // Keep UI + backend consistent if coupon applied
      if (bookingType === 'MOVIE') {
        setTotalPrice(amountToCharge);
      } else {
        setTotalPrice(amountToCharge);
      }

      let response;
      if (bookingType === 'MOVIE') {
        const token = localStorage.getItem('token');
        response = await fetch(`${API_BASE}/api/bookings/movie`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user.id,
            showId: selectedShow?.showId || selectedShow?.id || null,
            seats: selectedSeats,
            totalAmount: amountToCharge,
            paymentMethod: paymentInfo.paymentMethod,
          }),
        });
      } else {
        const token = localStorage.getItem('token');
        response = await fetch(`${API_BASE}/api/bookings/event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user.id,
            eventId: selectedEvent?.id,
            eventDateId: selectedDate?.id?.toString(),
            selectedZones,
            totalAmount: amountToCharge,
            paymentMethod: paymentInfo.paymentMethod,
          }),
        });
      }

      if (!response || !response.ok) {
        let msg = 'Failed to create booking. Please try again.';
        try {
          const text = await response.text();
          if (text) msg = text;
        } catch {
          // ignore
        }
        toast.error(msg);
        return; // stay on payment step
      }

      const bookingData = await response.json();
      setBookingId(bookingData.id); // Store booking ID from backend
      setBookingCode(bookingData.bookingCode || null);
      setBookingStep(4);
    } catch (e) {
      console.error('Error creating booking:', e);
      toast.error('Error creating booking. Please try again.');
    }
  };

  const handleNewBooking = () => {
    handleBack();
  };

  const handleAuthSuccess = (authData) => {
    // Persist auth so refresh stays on the same page
    try {
      if (authData?.token) localStorage.setItem('token', authData.token);
      localStorage.setItem('authUser', JSON.stringify(authData));
    } catch {
      // ignore storage failures
    }

    setUser(authData);
    setIsAuthenticated(true);
    if (authData.role === 'owner' || authData.role === 'OWNER') {
      setView('OWNER_DASHBOARD');
      navigate('/owner/dashboard');
    } else {
      setView('HOME');
      navigate('/home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUser');
    setView('HOME');
    setSelectedMovie(null);
    setSelectedEvent(null);
    setSelectedShow(null);
    setSelectedDate(null);
    setSelectedSeats([]);
    setSelectedZones({});
    setTotalPrice(0);
    setBookingStep(1);
    setIsAuthenticated(false);
    setUser(null);
    navigate('/');
  };

  const handleProfileNavigation = (action) => {
    if (action === 'settings') {
      setView('SETTINGS');
      navigate('/settings');
    } else if (action === 'bookings') {
      setView('BOOKINGS');
      navigate('/bookings');
    } else if (action === 'help-support') {
      setView('HELP_SUPPORT');
      navigate('/help-support');
    } else if (action === 'wishlist') {
      setView('WISHLIST');
      navigate('/wishlist');
    } else if (action === 'home') {
      handleNavigateHome();
    }
  };

  const handleSaveSettings = (formData) => {
    setUser({
      ...user,
      ...formData,
    });
  };

  const handleToggleWishlist = async (item) => {
    if (!user) {
      toast.error("Please login to add to wishlist");
      return;
    }

    // Optimistic update
    const exists = wishlist.find((w) => w.id === item.id && w.type === item.type);

    if (exists) {
      setWishlist((prev) => prev.filter((w) => !(w.id === item.id && w.type === item.type)));
    } else {
      setWishlist((prev) => [...prev, item]);
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/wishlist/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          ...item
        })
      });
      if (!res.ok) throw new Error("Failed");
    } catch (e) {
      console.error("Wishlist sync error", e);
      toast.error("Failed to update wishlist");
      // Revert state if needed, but keeping it simple for now
    }
  };

  const handleRemoveFromWishlist = async (id, type) => {
    if (!user) return;

    setWishlist((prev) => prev.filter((w) => !(w.id === id && w.type === type)));

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/wishlist/${user.id}/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {
      console.error("Wishlist removal error", e);
    }
  };

  const bookingDetails =
    bookingType === 'MOVIE'
      ? {
        selectedMovie,
        selectedShow,
        selectedSeats,
        totalPrice,
        bookingType: 'MOVIE',
        bookingId,
        bookingCode,
      }
      : {
        selectedEvent,
        selectedDate,
        selectedZones,
        totalPrice,
        bookingType: 'EVENT',
        bookingId,
        bookingCode,
      };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={user?.role === 'owner' || user?.role === 'OWNER' ? '/owner/dashboard' : '/home'} replace />
              ) : (
                <Login onAuthSuccess={handleAuthSuccess} />
              )
            }
          />
          <Route
            path="/register"
            element={
              user ? (
                <Navigate to={user?.role === 'owner' || user?.role === 'OWNER' ? '/owner/dashboard' : '/home'} replace />
              ) : (
                <Register onAuthSuccess={handleAuthSuccess} />
              )
            }
          />

          {/* Protected Routes */}
          <Route
            path="/home"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-cinema-light text-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      {/* Top row */}
                      <div className="flex items-center justify-between py-3 md:py-0 md:h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                            <p className="text-xs text-slate-500 font-medium">Your Entertainment Hub</p>
                          </div>
                        </button>

                        {/* Center search (md+) */}
                        <div className="hidden md:flex flex-1 justify-center px-4">
                          <div className="relative w-full max-w-lg">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search movies & events..."
                              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>

                      {/* Mobile search row */}
                      <div className="md:hidden pb-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search movies & events..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </header>
                  <Home
                    onMovieSelect={handleMovieSelect}
                    onEventSelect={handleEventSelect}
                    user={user}
                    wishlist={wishlist}
                    onToggleWishlist={handleToggleWishlist}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                  />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/movie/:id"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      <div className="flex items-center justify-between h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                          </div>
                        </button>
                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>
                    </div>
                  </header>
                  <MovieDetails onBookNow={handleBookNow} />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/event/:id"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      <div className="flex items-center justify-between h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                          </div>
                        </button>
                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>
                    </div>
                  </header>
                  <EventDetails onBookNow={handleEventBookNow} />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-cinema-light text-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      <div className="flex items-center justify-between h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                          </div>
                        </button>
                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>
                    </div>
                  </header>
                  <Settings user={user} onBack={handleNavigateHome} onSave={handleSaveSettings} />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bookings"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-cinema-light text-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      <div className="flex items-center justify-between h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                          </div>
                        </button>
                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>
                    </div>
                  </header>
                  <MyBookings user={user} onBack={handleNavigateHome} />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/wishlist"
            element={
              <ProtectedRoute user={user}>
                <div className="min-h-screen bg-cinema-light text-white">
                  <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                      <div className="flex items-center justify-between h-16">
                        <button
                          onClick={handleNavigateHome}
                          className="flex items-center gap-2 sm:gap-3 group"
                        >
                          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SHOW TIME</h1>
                          </div>
                        </button>
                        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                      </div>
                    </div>
                  </header>
                  <Wishlist
                    user={user}
                    wishlist={wishlist}
                    onBack={handleNavigateHome}
                    onMovieSelect={handleMovieSelect}
                    onEventSelect={handleEventSelect}
                    onRemoveFromWishlist={handleRemoveFromWishlist}
                  />
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/help-support"
            element={
              <ProtectedRoute user={user}>
                <HelpAndSupport onBack={handleNavigateHome} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute user={user}>
                {user?.role === 'owner' || user?.role === 'OWNER' ? (
                  <div className="min-h-screen bg-cinema-light text-white">
                    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                        <div className="flex items-center justify-between h-16">
                          <button
                            onClick={handleNavigateHome}
                            className="flex items-center gap-2 sm:gap-3 group"
                          >
                            <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                              <span className="text-2xl">🎬</span>
                            </div>
                            <div className="hidden sm:block">
                              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                SHOW TIME
                              </h1>
                            </div>
                          </button>
                          <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={handleProfileNavigation} />
                        </div>
                      </div>
                    </header>
                    <OwnerDashboard user={user} />
                  </div>
                ) : (
                  <Navigate to="/home" replace />
                )}
              </ProtectedRoute>
            }
          />

          {/* Booking Routes */}
          <Route
            path="/booking/movie"
            element={
              <ProtectedRoute user={user}>
                <BookingLayout
                  selectedMovie={location.state?.movie || selectedMovie}
                  currentStep={bookingStep}
                  bookingDetails={bookingDetails}
                  onBack={handleBack}
                  onTimeSelect={handleTimeSelect}
                  onSeatsSelect={handleSeatsSelect}
                  onPaymentComplete={handlePaymentComplete}
                  onNewBooking={handleNewBooking}
                  onStepChange={handleStepChange}
                />
              </ProtectedRoute>
            }
          />

          <Route
            path="/booking/event"
            element={
              <ProtectedRoute user={user}>
                <EventBookingLayout
                  selectedEvent={location.state?.event || selectedEvent}
                  currentStep={bookingStep}
                  bookingDetails={bookingDetails}
                  onBack={handleBack}
                  onDateSelect={handleDateSelect}
                  onZonesSelect={handleZonesSelect}
                  onPaymentComplete={handlePaymentComplete}
                  onNewBooking={handleNewBooking}
                  onStepChange={setBookingStep}
                />
              </ProtectedRoute>
            }
          />

          {/* Public Ticket View Route (accessible via QR code scan) */}
          <Route path="/ticket/:id" element={<TicketView />} />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
};

export default AppContent;


