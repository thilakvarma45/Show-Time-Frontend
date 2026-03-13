import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, CheckCircle, Users, Search, DollarSign, MapPin, XCircle, Ticket } from 'lucide-react';

const BookingDetails = ({ item, owner, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTime, setFilterTime] = useState('all'); // placeholder for future backend-based filter
  const [bookings, setBookings] = useState([]);
  const [eventZoneNameById, setEventZoneNameById] = useState({});
  const [eventDatesById, setEventDatesById] = useState({});

  // If this is an event, load its eventConfig once so we can show Zone NAME instead of zoneId.
  useEffect(() => {
    const loadEventZones = async () => {
      if (item?.type !== 'event' || !item?.id) {
        setEventZoneNameById({});
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://show-time-backend-production.up.railway.app/api/events/${item.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Failed to load event details');
        }
        const full = await res.json();
        let parsed = {};
        try {
          parsed = full?.eventConfig ? JSON.parse(full.eventConfig) : {};
        } catch {
          parsed = {};
        }

        const zones = Array.isArray(parsed?.zones) ? parsed.zones : [];
        const zoneMap = zones.reduce((acc, z) => {
          if (z?.id) acc[String(z.id)] = z?.name || String(z.id);
          return acc;
        }, {});
        setEventZoneNameById(zoneMap);

        const dates = Array.isArray(parsed?.dates) ? parsed.dates : [];
        const dateMap = dates.reduce((acc, d) => {
          if (d?.id) acc[String(d.id)] = { date: d.date, time: d.time };
          return acc;
        }, {});
        setEventDatesById(dateMap);

      } catch (e) {
        console.error('Error loading event zones:', e);
        setEventZoneNameById({});
        setEventDatesById({});
      }
    };

    loadEventZones();
  }, [item]);

  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Determine correct ID and endpoints
        const isMovie = item.type === 'movie';
        const idToUse = isMovie ? (item.tmdbMovieId ?? item.id) : item.id;

        const analyticsUrl = `https://show-time-backend-production.up.railway.app/api/analytics/${isMovie ? 'movie' : 'event'}/${idToUse}${item.ownerId ? `?ownerId=${item.ownerId}` : (owner?.id ? `?ownerId=${owner.id}` : '')}`;
        const bookingsUrl = `https://show-time-backend-production.up.railway.app/api/bookings/${isMovie ? 'movie' : 'event'}/${idToUse}${item.ownerId ? `?ownerId=${item.ownerId}` : (owner?.id ? `?ownerId=${owner.id}` : '')}`;

        // Fetch Analytics and Bookings in parallel
        const [analyticsRes, bookingsRes] = await Promise.all([
          fetch(analyticsUrl, { headers }),
          fetch(bookingsUrl, { headers })
        ]);

        if (analyticsRes.ok) {
          setAnalytics(await analyticsRes.json());
        }

        if (bookingsRes.ok) {
          const data = await bookingsRes.json();

          // Normalize bookings for the table (we don't need to filter anymore!)
          const normalized = data.map((b) => {
            let seats = [];
            let ticketCount = 0;

            try {
              if (b.bookingDetails) {
                const details = JSON.parse(b.bookingDetails);

                // Movie bookings: seats array
                if (b.type === 'MOVIE' && Array.isArray(details.seats)) {
                  seats = details.seats;
                  ticketCount = seats.length;
                }

                // Event bookings
                if (b.type === 'EVENT' && details.selectedZones && typeof details.selectedZones === 'object') {
                  const zoneEntries = Object.entries(details.selectedZones);
                  const zoneSummaries = zoneEntries.map(([zoneId, categories]) => {
                    const totalForZone = Object.values(categories || {}).reduce(
                      (sum, qty) => sum + (Number(qty) || 0),
                      0
                    );
                    ticketCount += totalForZone;
                    const zoneName = eventZoneNameById[String(zoneId)] || zoneId;
                    return { label: `${zoneName}: ${totalForZone}`, total: totalForZone };
                  });
                  seats = zoneSummaries.filter((z) => z.total > 0).map((z) => z.label);
                }
              }
            } catch {
              seats = [];
              ticketCount = 0;
            }

            // Show Date/Time
            let showDate = b.show?.showDate || (b.bookedAt ? b.bookedAt.substring(0, 10) : '');
            let showTime = b.show?.showTime || '';
            if (b.type === 'EVENT' && b.eventDateId && eventDatesById[b.eventDateId]) {
              showDate = eventDatesById[b.eventDateId].date;
              showTime = eventDatesById[b.eventDateId].time;
            }

            // Venue Name
            const venueName = b.show?.venue?.name || b.event?.venue?.name || (b.event?.address) || 'Unknown Venue';

            return {
              id: b.bookingCode || `BK${b.id}`,
              userName: b.user?.name || b.userName || 'Guest', // Handle both entity and summary structures
              seats,
              ticketCount,
              date: showDate,
              time: showTime,
              status: b.status || 'CONFIRMED',
              totalAmount: Number(b.totalAmount) || 0,
              venueName,
            };
          });
          setBookings(normalized);
        }
      } catch (e) {
        console.error('Error loading data:', e);
      }
    };
    loadData();
  }, [item, eventZoneNameById, eventDatesById]);

  // Filter bookings (client-side search only)
  const filteredBookings = bookings.filter(booking => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        booking.id.toLowerCase().includes(query) ||
        booking.userName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group bookings by date and time
  const groupedBookings = filteredBookings.reduce((acc, booking) => {
    const key = `${booking.date} ${booking.time}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(booking);
    return acc;
  }, {});

  // Get unique times for filter
  const uniqueTimes = [...new Set(bookings.map(b => b.time))];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with Backdrop */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
        {/* Blurred Background */}
        <div className="absolute inset-0">
          <img
            src={item.poster}
            alt=""
            className="w-full h-full object-cover opacity-30 blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-900/40" />
        </div>

        <div className="relative p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start">
          <button
            onClick={onBack}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <img
            src={item.poster}
            alt={item.title}
            className="w-48 h-72 object-cover rounded-2xl shadow-2xl ring-4 ring-white/10 hidden md:block"
          />

          <div className="flex-1 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${item.type === 'movie' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                  }`}>
                  {item.type === 'movie' ? 'Movie' : 'Event'}
                </span>
                {item.type === 'movie' && (
                  <span className="text-white/60 text-sm font-medium">
                    {item.duration || '2h 15m'}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                {item.title}
              </h1>
              {item.type === 'movie' && (
                <p className="text-lg text-white/70 max-w-2xl">
                  {Array.isArray(item.genre) ? item.genre.join(', ') : 'Action, Drama'}
                </p>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ₹{analytics ? analytics.totalRevenue.toLocaleString() : '0'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-white">
                  {analytics ? analytics.totalBookings : '0'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hidden md:block">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">
                  {item.type === 'movie' ? 'Total Seats Sold' : 'Passes Sold'}
                </p>
                <p className="text-2xl font-bold text-white">
                  {analytics ? analytics.totalSeats : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue by Theatre Section */}
      {(() => {
        const theatreRevenue = bookings.reduce((acc, booking) => {
          // Exclude cancelled bookings from revenue calculation
          if (booking.status === 'CANCELLED') return acc;

          const theatre = booking.venueName;
          if (!acc[theatre]) {
            acc[theatre] = { revenue: 0, bookings: 0, seats: 0 };
          }
          acc[theatre].revenue += booking.totalAmount;
          acc[theatre].bookings += 1;
          acc[theatre].seats += booking.ticketCount || booking.seats.length;
          return acc;
        }, {});

        return (
          Object.keys(theatreRevenue).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(theatreRevenue).map(([theatre, stats]) => (
                <div key={theatre} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-lg truncate" title={theatre}>{theatre}</p>
                      <p className="text-xs text-slate-500 font-medium">{stats.bookings} active bookings</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Revenue</p>
                      <p className="text-xl font-black text-slate-900">₹{stats.revenue.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase">Seats</p>
                      <p className="text-lg font-bold text-slate-700">{stats.seats}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        );
      })()}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
        <Search className="ml-4 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search booking ID, customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 py-3 bg-transparent border-none text-slate-900 placeholder-slate-400 focus:ring-0 font-medium"
        />
        <div className="pr-4 text-xs font-bold text-slate-400 uppercase">
          {filteredBookings.length} ROWS
        </div>
      </div>

      {/* Grouped Bookings */}
      <div className="space-y-8">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No bookings found</h3>
          </div>
        ) : (
          Object.entries(groupedBookings).map(([showTime, showBookings], index) => (
            <motion.div
              key={showTime}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
            >
              {/* Show Header */}
              <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    {showTime}
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-600">
                    {showBookings.length} Bookings
                  </span>
                </div>
              </div>

              {/* Bookings List */}
              <div className="divide-y divide-slate-100">
                {showBookings.map((booking) => (
                  <div key={booking.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center gap-6">
                    <div className="min-w-[140px]">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Booking ID</p>
                      <p className="text-sm font-mono font-bold text-slate-700">{booking.id}</p>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {booking.userName.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-bold text-slate-900">{booking.userName}</p>
                      </div>
                      <p className="text-xs text-slate-500 font-medium pl-11">{booking.venueName}</p>
                    </div>

                    <div className="flex-1">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Selected Seats</p>
                      <div className="flex flex-wrap gap-1">
                        {booking.seats.map((seat, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                            {seat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:text-right min-w-[120px]">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${booking.status === 'CANCELLED'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-600'
                        }`}>
                        {booking.status === 'CANCELLED' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        {booking.status === 'CANCELLED' ? 'Cancelled' : 'Confirmed'}
                      </div>
                      {booking.status !== 'CANCELLED' && (
                        <p className="text-sm font-bold text-slate-900 mt-2">
                          ₹{booking.totalAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingDetails;

