import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Download, Share2, Calendar, Clock, MapPin, Armchair } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatBookingId, formatCurrency } from '../../utils/formatters';
import { toPng } from 'html-to-image';

const Ticket = ({ bookingDetails, onNewBooking }) => {
  const isEvent = bookingDetails.bookingType === 'EVENT';
  const item = isEvent ? bookingDetails.selectedEvent : bookingDetails.selectedMovie;
  const displayBookingId = formatBookingId(bookingDetails.bookingCode || bookingDetails.bookingId) || `BK${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const ticketUrl = `${window.location.origin}/ticket/${bookingDetails.bookingCode || bookingDetails.bookingId || 'preview'}`;
  const ticketRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState(null);

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

      const url = await loadPosterDataUrl(item?.poster);
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          Booking Confirmed!
        </h2>
        <p className="text-slate-600">Your tickets have been sent to your email</p>
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
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isEvent ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
            {isEvent ? 'Event' : 'Movie'}
          </span>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Main info */}
          <div className="flex-1 p-6">
            <div className="flex gap-4">
              {/* Poster (small vertical) */}
              <div className="flex-shrink-0">
                {!captureMode ? (
                  <img
                    src={item?.poster}
                    alt={item?.title || 'Poster'}
                    className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl bg-gradient-to-br from-slate-200 to-slate-100 border border-slate-200 flex items-center justify-center">
                    {posterDataUrl ? (
                      <img
                        src={posterDataUrl}
                        alt={item?.title || 'Poster'}
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

              <div className="min-w-0 flex-1">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">{item?.title || 'Unknown Title'}</h3>
                {!isEvent && item?.genre?.length ? (
                  <div className="mt-1 text-xs text-slate-500">{item.genre.slice(0, 3).join(' • ')}</div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isEvent ? (
                    <>
                      <div className="flex gap-3">
                        <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Venue</div>
                          <div className="text-slate-900 font-semibold">{bookingDetails.selectedDate?.venue}</div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Calendar className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Date & Time</div>
                          <div className="text-slate-900 font-semibold">{bookingDetails.selectedDate?.label}</div>
                        </div>
                      </div>
                      <div className="flex gap-3 sm:col-span-2">
                        <Armchair className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Zones & Passes</div>
                          <div className="text-slate-900 font-semibold break-words">
                            {Object.entries(bookingDetails.selectedZones || {}).map(([zoneName, categories]) => {
                              const details = Object.entries(categories).map(([cat, qty]) => `${qty} ${cat}${qty > 1 ? 's' : ''}`).join(', ');
                              return `${zoneName}: ${details}`;
                            }).join(' | ')}
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
                          <div className="text-slate-900 font-semibold">{bookingDetails.selectedShow?.theatreName}</div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Date</div>
                          <div className="text-slate-900 font-semibold">
                            {bookingDetails.selectedShow?.date?.day} {bookingDetails.selectedShow?.date?.date}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Show Time</div>
                          <div className="text-slate-900 font-semibold">{bookingDetails.selectedShow?.time}</div>
                        </div>
                      </div>
                      <div className="flex gap-3 sm:col-span-2">
                        <Armchair className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">Seats</div>
                          <div className="text-slate-900 font-semibold break-words">{bookingDetails.selectedSeats?.join(', ')}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-slate-500 text-[11px] uppercase tracking-wider">Total Amount</div>
                  <div className={`text-2xl font-black ${isEvent ? 'text-emerald-600' : 'text-blue-600'}`}>{formatCurrency(bookingDetails.totalPrice)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* QR stub */}
          <div className="relative md:w-56 bg-white border-t md:border-t-0 md:border-l border-dashed border-slate-300 p-6 flex flex-col items-center justify-center">
            <div className="hidden md:block absolute -left-3 top-10 w-6 h-6 rounded-full bg-slate-50 border border-slate-200" />
            <div className="hidden md:block absolute -left-3 bottom-10 w-6 h-6 rounded-full bg-slate-50 border border-slate-200" />

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <QRCodeSVG value={ticketUrl} size={120} level="H" includeMargin={false} />
            </div>
            <p className="text-xs text-slate-500 mt-3">Scan at {isEvent ? 'Venue' : 'Theatre'}</p>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex gap-4"
      >
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`flex-1 px-6 py-3 bg-white border border-slate-300 ${isEvent ? 'hover:border-emerald-600' : 'hover:border-blue-600'} text-slate-900 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <Download className="w-5 h-5" />
          {downloading ? 'Downloading...' : 'Download'}
        </button>
        <button className={`flex-1 px-6 py-3 bg-white border border-slate-300 ${isEvent ? 'hover:border-emerald-600' : 'hover:border-blue-600'} text-slate-900 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-md`}>
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </motion.div>

      {/* Book Another */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={onNewBooking}
        className={`w-full px-6 py-3 ${isEvent ? 'text-emerald-600 hover:text-emerald-700' : 'text-blue-600 hover:text-blue-700'} rounded-lg font-semibold transition-colors`}
      >
        Book Another {isEvent ? 'Event' : 'Movie'}
      </motion.button>
    </div>
  );
};

export default Ticket;


