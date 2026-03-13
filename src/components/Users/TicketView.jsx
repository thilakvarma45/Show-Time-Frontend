import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, MapPin, Armchair, ArrowLeft, Loader2, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { getMovieById } from '../../services/tmdb';
import { formatBookingId, formatCurrency, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

const TicketView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ticketRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        setLoading(true);
        const raw = (id || '').toString();
        const isCode = raw.toUpperCase().startsWith('BK');

        const response = isCode
          ? await fetch(`https://show-time-backend-production.up.railway.app/api/bookings/public/${encodeURIComponent(raw)}`)
          : await fetch(`https://show-time-backend-production.up.railway.app/api/bookings/${encodeURIComponent(raw)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });

        if (!response.ok) {
          throw new Error('Booking not found');
        }
        const data = await response.json();
        setBooking(data);

        // If it's a movie booking, fetch movie details from TMDB
        if (data.type === 'MOVIE' && data.show?.tmdbMovieId) {
          try {
            const movie = await getMovieById(data.show.tmdbMovieId);
            setMovieDetails(movie);
          } catch (err) {
            console.error('Error fetching movie details:', err);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id && id !== 'preview') {
      fetchBooking();
    } else {
      setError('Invalid booking ID');
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <LoadingSpinner size={8} className="min-h-screen" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-lg text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Not Found</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const isEvent = booking?.type === 'EVENT';
  const item = isEvent ? booking?.event : booking?.show;
  const displayBookingId = formatBookingId(booking?.bookingCode || booking?.id);
  const ticketUrl = `${window.location.origin}/ticket/${booking?.bookingCode || booking?.id}`;
  const movieTitle = movieDetails?.title || `Show #${item?.id}`;
  const moviePoster = movieDetails?.poster || null;
  const poster = isEvent ? booking?.event?.posterUrl : moviePoster;

  const loadPosterDataUrl = async (src) => {
    if (!src) return null;
    try {
      const isTmdb = src.startsWith('https://image.tmdb.org/');
      const fetchUrl = isTmdb
        ? `https://show-time-backend-production.up.railway.app/api/upload/tmdb-proxy?url=${encodeURIComponent(src)}`
        : src;

      const res = await fetch(fetchUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || !blob.size) return null;

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch (e) {
      console.error('Failed to load poster for export', e);
      return null;
    }
  };

  const handleDownload = async () => {
    if (!ticketRef.current || downloading) return;
    try {
      setDownloading(true);
      setCaptureMode(true);
      setPosterDataUrl(null);

      // If poster is from TMDB, proxy + inline it so export can include it
      const url = await loadPosterDataUrl(poster);
      if (url) setPosterDataUrl(url);

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${displayBookingId}.png`;
      a.click();
    } catch (e) {
      console.error('Failed to download ticket image', e);
    } finally {
      setCaptureMode(false);
      setDownloading(false);
      setPosterDataUrl(null);
    }
  };

  // Parse booking details
  let bookingDetails = {};
  try {
    bookingDetails = JSON.parse(booking?.bookingDetails || '{}');
  } catch (e) {
    console.error('Error parsing booking details:', e);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        </div>

        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-green-600 rounded-full mb-4"
          >
            <CheckCircle className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 uppercase tracking-wide">
            Your Ticket
          </h2>
          <p className="text-slate-600">Present this at the {isEvent ? 'venue' : 'theatre'}</p>
        </motion.div>

        {/* Digital Ticket */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl"
          ref={ticketRef}
        >
          {/* Top strip */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] tracking-widest uppercase text-slate-500">Booking ID</div>
              <div className="font-mono font-bold text-slate-900 truncate">{displayBookingId}</div>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${booking?.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-700'
                : booking?.status === 'CANCELLED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
                }`}
            >
              {booking?.status || 'PENDING'}
            </span>
          </div>

          {/* Ticket body */}
          <div className="flex flex-col md:flex-row">
            {/* Main info */}
            <div className="flex-1 p-6">
              <div className="flex gap-4">
                {/* Poster (small vertical) */}
                <div className="flex-shrink-0">
                  {poster && !captureMode ? (
                    <img
                      src={poster}
                      alt={isEvent ? item?.title : movieTitle}
                      className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover border border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl bg-gradient-to-br from-slate-200 to-slate-100 border border-slate-200 flex items-center justify-center">
                      {captureMode && posterDataUrl ? (
                        <img
                          src={posterDataUrl}
                          alt={isEvent ? item?.title : movieTitle}
                          className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold px-2 text-center">
                          {isEvent ? 'EVENT' : 'MOVIE'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                      {isEvent ? item?.title : movieTitle}
                    </h3>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isEvent ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}
                    >
                      {isEvent ? 'Event' : 'Movie'}
                    </span>
                  </div>

                  {!isEvent && movieDetails?.genre?.length ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {movieDetails.genre.slice(0, 3).join(' • ')}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isEvent ? (
                      <>
                        <div className="flex gap-3">
                          <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Venue</div>
                            <div className="text-slate-900 font-semibold">{item?.venue?.name || '—'}</div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Calendar className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Date</div>
                            <div className="text-slate-900 font-semibold">
                              {(() => {
                                if (!booking?.eventDateId) return '—';
                                try {
                                  if (booking?.event?.eventConfig) {
                                    const config = JSON.parse(booking.event.eventConfig);
                                    const dateObj = config.dates?.find(d => d.id === booking.eventDateId);
                                    if (dateObj) return `${dateObj.date} (${dateObj.time})`;
                                  }
                                } catch (e) { /* ignore */ }
                                return booking.eventDateId;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 sm:col-span-2">
                          <Armchair className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Zones & Passes</div>
                            <div className="text-slate-900 font-semibold break-words">
                              {bookingDetails.selectedZones ? (
                                Object.entries(bookingDetails.selectedZones).map(([zoneName, categories]) => {
                                  const details = Object.entries(categories)
                                    .map(([cat, qty]) => `${qty} ${cat}${qty > 1 ? 's' : ''}`)
                                    .join(', ');
                                  return `${zoneName}: ${details}`;
                                }).join(' | ')
                              ) : '—'}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex gap-3">
                          <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Theatre</div>
                            <div className="text-slate-900 font-semibold">{item?.venue?.name || '—'}</div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Date</div>
                            <div className="text-slate-900 font-semibold">{formatDate(item?.showDate)}</div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Show Time</div>
                            <div className="text-slate-900 font-semibold">{item?.showTime || '—'}</div>
                          </div>
                        </div>
                        <div className="flex gap-3 sm:col-span-2">
                          <Armchair className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Seats</div>
                            <div className="text-slate-900 font-semibold break-words">
                              {bookingDetails.seats ? bookingDetails.seats.join(', ') : '—'}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-slate-500 text-[11px] uppercase tracking-wider">Total Amount</div>
                      <div className={`text-2xl font-black ${isEvent ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {formatCurrency(booking?.totalAmount)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      Booked on {formatDate(booking?.bookedAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* QR stub */}
            <div className="relative md:w-56 bg-white border-t md:border-t-0 md:border-l border-dashed border-slate-300 p-6 flex flex-col items-center justify-center">
              {/* Ticket perforation effect (desktop) */}
              <div className="hidden md:block absolute -left-3 top-10 w-6 h-6 rounded-full bg-slate-50 border border-slate-200" />
              <div className="hidden md:block absolute -left-3 bottom-10 w-6 h-6 rounded-full bg-slate-50 border border-slate-200" />

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <QRCodeSVG value={ticketUrl} size={120} level="H" includeMargin={false} />
              </div>
              <p className="text-xs text-slate-500 mt-3">Scan at {isEvent ? 'Venue' : 'Theatre'}</p>
            </div>
          </div>
        </motion.div>

        {/* Footer Info */}
        <div className="text-center text-sm text-slate-600">
          <p>Booked on: {formatDate(booking?.bookedAt)}</p>
          <p className="mt-1">Payment: {booking?.paymentMethod?.toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
};

export default TicketView;

