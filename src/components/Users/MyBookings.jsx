import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MapPin, Clock, Ticket, Loader2 } from 'lucide-react';
import { getMovieById } from '../../services/tmdb';
import { formatCurrency, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

const MyBookings = ({ user, onBack }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoading(true);
        if (!user?.id) {
          setBookings([]);
          setLoading(false);
          return;
        }
        const token = localStorage.getItem('token');
        const res = await fetch(`https://show-time-backend-production.up.railway.app/api/bookings/user/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Failed to load bookings');
        }
        const data = await res.json();

        // Process bookings and fetch movie details for movie bookings
        const normalized = await Promise.all(data.map(async (b) => {
          let title = 'Booking';
          let poster = 'https://via.placeholder.com/300x450?text=Ticket';
          let seats = [];
          let time = '';
          let venue = 'Venue';
          let date = formatDate(b.bookedAt);

          // Parse booking details
          let details = {};
          try {
            details = JSON.parse(b.bookingDetails || '{}');
          } catch (e) {
            console.error('Error parsing booking details:', e);
          }

          if (b.type === 'MOVIE') {
            // Check if show data exists
            if (!b.show) {
              // Handle legacy bookings without show data
              title = 'Movie Booking';
              venue = 'Theatre';
              seats = details.seats || [];
            } else {
              // Fetch movie details from TMDB
              if (b.show.tmdbMovieId) {
                try {
                  const movie = await getMovieById(b.show.tmdbMovieId);
                  title = movie.title;
                  poster = movie.poster;
                } catch (err) {
                  console.error('Error fetching movie details:', err);
                  title = `Movie #${b.show.tmdbMovieId}`;
                }
              }

              // Get show details
              time = b.show.showTime || '';
              date = formatDate(b.show.showDate) || date;
              // Get venue name - now eagerly loaded
              venue = b.show.venue?.name || b.show.schedule?.venue?.name || 'Theatre';
              seats = details.seats || [];
            }
          } else {
            // Event booking
            title = b.event?.title || 'Event';
            poster = b.event?.posterUrl || poster;
            venue = b.event?.venue?.name || 'Event Venue';

            // Parse event zones/passes
            if (details.selectedZones) {
              seats = Object.entries(details.selectedZones).flatMap(([zoneId, categories]) => {
                return Object.entries(categories).map(([cat, qty]) =>
                  `${cat}: ${qty}`
                );
              });
            }
          }

          return {
            id: b.id,
            bookingCode: b.bookingCode,
            type: b.type === 'EVENT' ? 'event' : 'movie',
            title,
            poster,
            date,
            time,
            venue,
            seats,
            price: b.totalAmount,
            status: b.status?.toLowerCase() || 'confirmed',
          };
        }));

        setBookings(normalized);
      } catch (err) {
        console.error('Error loading bookings:', err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    loadBookings();
  }, [user]);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Modal states: 'confirm' | 'processing' | 'refund' | 'success' | 'error'
  const [cancelStep, setCancelStep] = useState('confirm');
  const [cancelError, setCancelError] = useState('');

  const handleCancelClick = (booking) => {
    setSelectedBooking(booking);
    setCancelStep('confirm');
    setCancelError('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!selectedBooking) return;

    try {
      setCancelStep('processing');
      const token = localStorage.getItem('token');

      // Simulate network delay for UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      const res = await fetch(`https://show-time-backend-production.up.railway.app/api/bookings/${selectedBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      // Success flow
      setCancelStep('refund');
      await new Promise(resolve => setTimeout(resolve, 1500));

      setCancelStep('success');

      // Update local state to reflect cancellation
      setBookings(prev => prev.map(b =>
        b.id === selectedBooking.id
          ? { ...b, status: 'cancelled' }
          : b
      ));

      // Auto close after success
      setTimeout(() => {
        setShowCancelModal(false);
        setSelectedBooking(null);
      }, 2000);

    } catch (err) {
      setCancelStep('error');
      setCancelError(err.message);
    }
  };

  const renderModalContent = () => {
    switch (cancelStep) {
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Processing your request...</h3>
            <p className="text-sm text-slate-500">Please wait while we cancel your booking.</p>
          </div>
        );
      case 'refund':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Refund Initiated</h3>
            <p className="text-sm text-slate-500">Amount will be credited to your original payment method.</p>
          </div>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Cancellation Successful</h3>
            <p className="text-sm text-slate-500">Your booking has been cancelled.</p>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-2xl font-bold">!</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancellation Failed</h3>
            <p className="text-sm text-red-600 text-center mb-6 px-4 py-3 bg-red-50 rounded-lg w-full">
              {cancelError}
            </p>
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        );
      case 'confirm':
      default:
        return (
          <>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Cancel Booking?</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to cancel this booking? This action cannot be undone.
              Refunds will be processed to your original payment method.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Confirm Cancellation
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 sm:px-8 py-8 sm:py-12 relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto mb-8"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
          My Bookings
        </h1>
        <p className="text-slate-600 text-sm sm:text-base">
          View and manage your reservations
        </p>
      </motion.div>

      {/* Bookings List */}
      <div className="max-w-6xl mx-auto space-y-4">
        {loading ? (
          <LoadingSpinner size={8} className="py-20" />
        ) : bookings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm"
          >
            <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No bookings yet</h3>
            <p className="text-slate-600">Start exploring movies and events to make your first booking!</p>
          </motion.div>
        ) : (
          bookings.map((booking, index) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all"
            >
              <div className="flex flex-col sm:flex-row gap-6 p-6">
                {/* Poster */}
                <div className="flex-shrink-0">
                  <img
                    src={booking.poster}
                    alt={booking.title}
                    className="w-full sm:w-32 h-48 sm:h-44 object-cover rounded-lg"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{booking.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {booking.type === 'movie' ? 'Movie' : 'Event'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{booking.date}</span>
                    </div>
                    {booking.time && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">{booking.time}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{booking.venue}</span>
                    </div>
                    {booking.seats.length > 0 && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Ticket className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">{booking.seats.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(booking.price)}</p>
                    </div>
                    <div className="flex gap-3">
                      {booking.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelClick(booking)}
                          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors text-sm"
                        >
                          Cancel Booking
                        </button>
                      )}
                      <a
                        href={`/ticket/${booking.bookingCode || booking.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        View Ticket
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            {renderModalContent()}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;

