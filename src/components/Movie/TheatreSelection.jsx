import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { MapPin, Calendar, Search, Sun, Sunset, Moon } from 'lucide-react';

const TheatreSelection = ({ onTimeSelect, selectedShow, movieId }) => {
  const today = new Date();
  // Show the next 14 days so the user can book as long as shows exist in that window.
  const generatedDates = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${day}`;

    return {
      id: idx + 1,
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      date: d.getDate(),
      fullDate: fullDate
    };
  });

  const [selectedDate, setSelectedDate] = useState(selectedShow?.date?.id || generatedDates[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [theatres, setTheatres] = useState([]);
  const [datesWithShows, setDatesWithShows] = useState(new Set());
  const [allDatesLoaded, setAllDatesLoaded] = useState(false);

  // Load shows for ALL dates on mount to determine which dates have shows
  useEffect(() => {
    const loadAllDates = async () => {
      try {
        const res = await fetch('https://show-time-backend-production.up.railway.app/api/venues');
        if (!res.ok) return;

        const venues = await res.json();
        const theatreVenues = venues.filter(
          (v) => (v.type || '').toString().toUpperCase() === 'THEATRE'
        );

        const datesSet = new Set();

        // Check each date for shows
        await Promise.all(
          generatedDates.map(async (date) => {
            const hasShowsForDate = await Promise.all(
              theatreVenues.map(async (venue) => {
                try {
                  const url = movieId
                    ? `https://show-time-backend-production.up.railway.app/api/shows/venue/${venue.id}?date=${date.fullDate}&movieId=${movieId}`
                    : `https://show-time-backend-production.up.railway.app/api/shows/venue/${venue.id}?date=${date.fullDate}`;

                  const showRes = await fetch(url);
                  if (!showRes.ok) return false;
                  const shows = await showRes.json();
                  return shows.length > 0;
                } catch {
                  return false;
                }
              })
            );

            if (hasShowsForDate.some(has => has)) {
              datesSet.add(date.fullDate);
            }
          })
        );

        setDatesWithShows(datesSet);
        setAllDatesLoaded(true);
      } catch (err) {
        console.error('Error loading dates:', err);
        setAllDatesLoaded(true);
      }
    };

    loadAllDates();
  }, [movieId]);

  // Load theatres for selected date
  useEffect(() => {
    const loadTheatres = async () => {
      try {
        const res = await fetch('https://show-time-backend-production.up.railway.app/api/venues');
        if (!res.ok) {
          throw new Error('Failed to load venues');
        }
        const venues = await res.json();
        const theatreVenues = venues.filter(
          (v) => (v.type || '').toString().toUpperCase() === 'THEATRE'
        );

        const today = new Date();
        const baseDate = new Date(today);
        baseDate.setDate(today.getDate() + (selectedDate - 1));
        const isoDate = baseDate.toISOString().split('T')[0];

        const withShows = await Promise.all(
          theatreVenues.map(async (venue) => {
            try {
              const url = movieId
                ? `https://show-time-backend-production.up.railway.app/api/shows/venue/${venue.id}?date=${isoDate}&movieId=${movieId}`
                : `https://show-time-backend-production.up.railway.app/api/shows/venue/${venue.id}?date=${isoDate}`;

              const showRes = await fetch(url);
              if (!showRes.ok) {
                return { ...venue, shows: [] };
              }
              const shows = await showRes.json();
              return { ...venue, shows };
            } catch {
              return { ...venue, shows: [] };
            }
          })
        );

        setTheatres(withShows);
      } catch (err) {
        console.error('Error loading theatres/shows:', err);
        setTheatres([]);
      }
    };

    if (allDatesLoaded) {
      loadTheatres();
    }
  }, [selectedDate, movieId, allDatesLoaded]);

  const handleTimeClick = (theatre, show) => {
    onTimeSelect({
      showId: show.id,
      theatreId: theatre.id,
      theatreName: theatre.name,
      time: show.time,
      // pass all three category prices from backend
      silverPrice: show.silverPrice,
      goldPrice: show.goldPrice,
      vipPrice: show.vipPrice,
      // fallback single price for any older consumers
      price: show.goldPrice || show.silverPrice || show.vipPrice || 0,
      date: generatedDates.find((d) => d.id === selectedDate),
    });
  };

  // Get time of day styling based on session
  const getTimeSession = (timeString) => {
    const hour = parseInt(timeString.split(':')[0]);
    const isPM = timeString.toLowerCase().includes('pm');
    const actualHour = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);

    if (actualHour >= 5 && actualHour < 12) {
      return {
        icon: Sun,
        label: 'Morning',
        emoji: '🌅',
        bgColor: 'bg-gradient-to-r from-amber-400 to-yellow-500',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-600',
        hoverBorder: 'hover:border-amber-500',
        selectedBg: 'bg-gradient-to-r from-amber-500 to-yellow-600',
        shadow: 'shadow-amber-500/40'
      };
    } else if (actualHour >= 12 && actualHour < 17) {
      return {
        icon: Sun,
        label: 'Afternoon',
        emoji: '☀️',
        bgColor: 'bg-gradient-to-r from-orange-400 to-amber-500',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-600',
        hoverBorder: 'hover:border-orange-500',
        selectedBg: 'bg-gradient-to-r from-orange-500 to-amber-600',
        shadow: 'shadow-orange-500/40'
      };
    } else if (actualHour >= 17 && actualHour < 20) {
      return {
        icon: Sunset,
        label: 'Evening',
        emoji: '🌆',
        bgColor: 'bg-gradient-to-r from-rose-400 to-orange-500',
        borderColor: 'border-rose-400',
        textColor: 'text-rose-600',
        hoverBorder: 'hover:border-rose-500',
        selectedBg: 'bg-gradient-to-r from-rose-500 to-orange-600',
        shadow: 'shadow-rose-500/40'
      };
    } else {
      return {
        icon: Moon,
        label: 'Night',
        emoji: '🌙',
        bgColor: 'bg-gradient-to-r from-indigo-500 to-purple-600',
        borderColor: 'border-indigo-400',
        textColor: 'text-indigo-600',
        hoverBorder: 'hover:border-indigo-500',
        selectedBg: 'bg-gradient-to-r from-indigo-600 to-purple-700',
        shadow: 'shadow-indigo-500/40'
      };
    }
  };

  // Filter dates to only show those with shows
  const availableDates = useMemo(() => {
    if (!allDatesLoaded) return generatedDates; // Show all while loading
    return generatedDates.filter(date => datesWithShows.has(date.fullDate));
  }, [generatedDates, datesWithShows, allDatesLoaded]);

  // Auto-select the first available date if the current one has no shows
  useEffect(() => {
    if (allDatesLoaded && availableDates.length > 0) {
      const isSelectedAvailable = availableDates.some(d => d.id === selectedDate);
      if (!isSelectedAvailable) {
        setSelectedDate(availableDates[0].id);
      }
    }
  }, [allDatesLoaded, availableDates, selectedDate]);

  // Filter theatres by search query
  const filteredTheatres = theatres
    .map((theatre) => ({
      ...theatre,
      shows: Array.isArray(theatre.shows) ? theatre.shows : [],
    }))
    .filter((theatre) => {
      const matchesSearch =
        theatre.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        theatre.location.toLowerCase().includes(searchQuery.toLowerCase());
      // Only keep theatres that match search AND have at least one show for this date
      return matchesSearch && theatre.shows.length > 0;
    });

  return (
    <div className="space-y-6">
      {/* Date Strip */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg p-4 shadow-md"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-slate-900 font-semibold uppercase tracking-wider text-sm">
            Select Date
          </h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {availableDates.map((date) => (
            <button
              key={date.id}
              onClick={() => setSelectedDate(date.id)}
              className={`flex-shrink-0 px-6 py-3 rounded-lg border-2 transition-all ${selectedDate === date.id
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-transparent border-slate-300 text-slate-600 hover:border-blue-500'
                }`}
            >
              <div className="text-sm font-semibold">{date.day}</div>
              <div className="text-2xl font-bold">{date.date}</div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search theatres by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>
      </motion.div>

      {/* Theatre List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-900 font-semibold uppercase tracking-wider text-sm flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Select Theatre & Show Time
          </h3>
          <span className="text-sm text-slate-500">
            {filteredTheatres.length} {filteredTheatres.length === 1 ? 'theatre' : 'theatres'}
          </span>
        </div>

        {filteredTheatres.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-5xl mb-3">🎬</div>
            <h4 className="text-lg font-semibold text-slate-800 mb-1">No shows available</h4>
            <p className="text-slate-600 text-sm">
              {movieId
                ? "This movie has not been scheduled at any theatre yet. Please check back later or try a different date."
                : "There are currently no theatres with shows available for this date."}
            </p>
          </div>
        ) : (
          filteredTheatres.map((theatre, index) => (
            <motion.div
              key={theatre.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg p-6 border border-slate-200 hover:border-blue-500 transition-colors shadow-md"
            >
              {/* Theatre Info */}
              <div className="mb-4">
                <h4 className="text-slate-900 text-xl font-bold uppercase tracking-wide mb-1">
                  {theatre.name}
                </h4>
                <p className="text-slate-600 text-sm">{theatre.location}</p>
              </div>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {theatre.shows.length === 0 ? (
                  <div className="col-span-3 md:col-span-5 text-sm text-slate-500">
                    No shows scheduled for this theatre on the selected date.
                  </div>
                ) : (
                  theatre.shows.map((show) => {
                    const isSelected =
                      selectedShow?.theatreId === theatre.id &&
                      selectedShow?.time === show.time &&
                      selectedShow?.date?.id === selectedDate;

                    const session = getTimeSession(show.time);
                    const TimeIcon = session.icon;

                    return (
                      <button
                        key={show.id}
                        onClick={() => handleTimeClick(theatre, show)}
                        className={`relative px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm group ${isSelected
                          ? `${session.selectedBg} border-transparent text-white shadow-lg ${session.shadow} ring-2 ring-white/50 ring-offset-2`
                          : `bg-white ${session.borderColor} ${session.textColor} ${session.hoverBorder} hover:shadow-md`
                          }`}
                      >
                        {/* Time Icon */}
                        <TimeIcon className={`absolute top-1 left-1 w-3.5 h-3.5 ${isSelected ? 'text-white/80' : session.textColor} opacity-60`} />

                        {/* Time Text */}
                        <span className="block mt-1 font-bold">{show.time}</span>

                        {/* Session Label */}
                        <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'} uppercase tracking-wider`}>
                          {session.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Price Info (show-level pricing shown in seat selection / payment) */}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default TheatreSelection;


