import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Film, Calendar, ChevronRight, Search, SlidersHorizontal, Loader2, Ticket, TrendingUp, Users, Trash2 } from 'lucide-react';
import { getMovieById } from '../../services/tmdb';

/**
 * Owner Movie Listings.
 * Shows only movies that have active schedules/shows in any venue.
 * Shows only events created by this owner.
 */
const MovieListings = ({ onSelectShow, owner }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('movies'); // 'movies' | 'events'
  const [movies, setMovies] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load movies that have schedules/shows from backend for this owner
  useEffect(() => {
    const loadScheduledMovies = async () => {
      if (!owner?.id) {
        setMovies([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://show-time-backend-production.up.railway.app/api/shows/summary?ownerId=${owner.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }); // summary list per tmdbMovieId filtered by owner
        if (!res.ok) {
          throw new Error('Failed to load scheduled movies');
        }
        const data = await res.json();
        // Each item: { tmdbMovieId, showCount, firstShowDate, lastShowDate, totalBookings, totalRevenue, theatres }

        // Fetch movie details from TMDB for each movie
        const moviesWithDetails = await Promise.all(
          data.map(async (movie) => {
            try {
              const tmdbMovie = await getMovieById(movie.tmdbMovieId);
              return {
                ...movie, // includes totalRevenue, totalBookings, theatres from backend
                title: tmdbMovie.title,
                poster: tmdbMovie.poster,
                genre: tmdbMovie.genre,
                duration: tmdbMovie.duration,
              };
            } catch (err) {
              console.error(`Failed to fetch TMDB details for movie ${movie.tmdbMovieId}:`, err);
              // Return with placeholder if TMDB fetch fails
              return {
                ...movie, // includes totalRevenue, totalBookings, theatres from backend
                title: `Movie ${movie.tmdbMovieId}`,
                poster: 'https://via.placeholder.com/500x750?text=No+Poster',
                genre: [],
                duration: 'N/A',
              };
            }
          })
        );

        setMovies(moviesWithDetails);
      } catch (err) {
        console.error('Error loading scheduled movies:', err);
        setError('Failed to load scheduled movies. Please try again later.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };
    loadScheduledMovies();
  }, [owner]);

  // Load events for listings (from backend) - only events created by this owner
  useEffect(() => {
    const loadEvents = async () => {
      if (!owner?.id) {
        setEvents([]);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://show-time-backend-production.up.railway.app/api/events/owner/${owner.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Failed to load events');
        }
        const data = await res.json();
        const normalized = data.map((eventData) => ({
          id: eventData.event?.id || eventData.id,
          type: 'event',
          title: eventData.event?.title || eventData.title,
          poster: eventData.event?.posterUrl || eventData.posterUrl,
          venue: eventData.event?.venue?.name || eventData.venue?.name || eventData.event?.address || eventData.address || 'Event venue',
          totalBookings: eventData.totalBookings || 0,
          totalRevenue: eventData.totalRevenue || 0,
        }));
        setEvents(normalized);
      } catch (err) {
        console.error('Error loading events:', err);
        setEvents([]);
      }
    };
    loadEvents();
  }, [owner]);

  const allListings = [
    ...movies.map((m) => ({ ...m, id: m.tmdbMovieId, type: 'movie' })),
    ...events,
  ];

  // Filter listings
  const filteredListings = allListings.filter((item) => {
    // Filter by type
    if (filterType === 'movies' && item.type !== 'movie') return false;
    if (filterType === 'events' && item.type !== 'event') return false;

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${item.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // endpoint based on type
      let url = '';
      if (item.type === 'movie') {
        url = `https://show-time-backend-production.up.railway.app/api/shows/movie/${item.tmdbMovieId}?ownerId=${owner.id}`;
      } else {
        // For events, we might need a different endpoint, e.g. /api/events/{id}
        // Assuming /api/events/{id}?ownerId=... for now or just alert
        // The user specifically asked for "movie he hosted".
        alert("Deleting events is not supported yet.");
        return;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Remove from local state immediately
        if (item.type === 'movie') {
          setMovies(prev => prev.filter(m => m.tmdbMovieId !== item.tmdbMovieId));
        }
      } else {
        const msg = await res.text();
        alert(`Failed to delete: ${msg}`);
      }
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed. Please try again.');
    }
  };

  return (
    <div className="space-y-8">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Active Listings</h1>
          <p className="text-slate-500 font-medium mt-1">Manage performance and bookings for your content.</p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex self-start md:self-auto">
          {['movies', 'events'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${filterType === type
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-2xl">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search listings by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium shadow-sm hover:border-slate-300"
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredListings.length} ITEMS</span>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
          <p className="text-slate-500 font-medium">Loading your portfolio...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
          <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Data</h3>
          <p className="text-red-600">{error}</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <Film className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No listings found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            {searchQuery ? `No matches for "${searchQuery}"` : "You haven't scheduled any movies or events yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredListings.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl hover:border-indigo-100 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => onSelectShow(item)}
            >
              {/* Poster Image */}
              <div className="relative aspect-[2/3] overflow-hidden">
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                {/* Floating Badge */}
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg backdrop-blur-md ${item.type === 'movie'
                    ? 'bg-blue-500/90 text-white'
                    : 'bg-purple-500/90 text-white'
                    }`}>
                    {item.type === 'movie' ? 'Movie' : 'Event'}
                  </span>
                </div>

                {/* Delete Button */}
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(e, item)}
                    title="Delete Listing"
                    className="p-2 bg-white/90 rounded-full hover:bg-red-500 hover:text-white text-slate-400 transition-all shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <h3 className="text-xl font-bold leading-tight mb-2 line-clamp-2 drop-shadow-md">
                    {item.title}
                  </h3>
                  {item.type === 'movie' ? (
                    <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.firstShowDate ? new Date(item.firstShowDate).toLocaleDateString() : 'N/A'}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.venue}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Footer */}
              <div className="p-5 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3" /> Bookings
                  </p>
                  <p className="text-lg font-bold text-slate-900">{item.totalBookings || 0}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-end gap-1">
                    <TrendingUp className="w-3 h-3" /> Revenue
                  </p>
                  <p className="text-lg font-bold text-emerald-600">₹{(item.totalRevenue || 0).toLocaleString()}</p>
                </div>

                <div className="col-span-2 pt-4 mt-2 border-t border-slate-100">
                  <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm group-hover:gap-3 transition-all">
                    Manage Details <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MovieListings;

