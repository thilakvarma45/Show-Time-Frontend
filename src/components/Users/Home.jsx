import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Calendar, SlidersHorizontal, Loader2, Heart, Sparkles, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { fetchPopularMovies, searchMovies, getMovieRecommendations, fetchTeluguRecentMovies, fetchRecentMoviesByLanguage } from '../../services/tmdb';
import MovieCard from '../Movie/MovieCard';

const Home = ({ onMovieSelect, onEventSelect, user, wishlist = [], onToggleWishlist, searchQuery = '', setSearchQuery }) => {
  const [sortBy, setSortBy] = useState('name'); // 'name', 'rating', 'latest'
  const [filterType, setFilterType] = useState('all'); // 'all', 'movies', 'events'
  const [language, setLanguage] = useState('all'); // TMDB original language code
  const [movies, setMovies] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recommended movies state
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);

  // Curated rows
  const [teluguMovies, setTeluguMovies] = useState([]);

  // Banner state (powered by already-fetched movies; no extra TMDB calls)
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Curated rows (only when not searching movies)
  const isSearchingMovies = Boolean(searchQuery.trim()) && filterType !== 'events';
  const isLanguageMode = filterType === 'movies' && !isSearchingMovies && language !== 'all';

  // Reset language when switching away from movies
  useEffect(() => {
    if (filterType !== 'movies' && language !== 'all') {
      setLanguage('all');
    }
  }, [filterType, language]);

  // Fetch movies from TMDB on mount and when search query changes
  useEffect(() => {
    const loadMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        let result;
        if (searchQuery.trim() && filterType !== 'events') {
          // Search movies if there's a query
          result = await searchMovies(searchQuery);
        } else if (filterType === 'movies' && language !== 'all') {
          // Language mode: recent releases for selected language
          const list = await fetchRecentMoviesByLanguage(language);
          result = { movies: list };
        } else if (filterType !== 'events') {
          // Load just one page (lightweight) for Worldwide row + fallbacks
          result = await fetchPopularMovies(1);
        } else {
          // If filtering by events only, don't fetch movies
          setMovies([]);
          setLoading(false);
          return;
        }
        setMovies(result.movies);
      } catch (err) {
        console.error('Error loading movies:', err);
        setError('Failed to load movies. Please try again later.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      loadMovies();
    }, searchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterType, language]);

  useEffect(() => {
    const loadCurated = async () => {
      try {
        const [telugu] = await Promise.all([fetchTeluguRecentMovies()]);
        setTeluguMovies((telugu || []).slice(0, 20).map(m => ({ ...m, type: 'movie' })));
      } catch (e) {
        console.error('Error loading curated rows:', e);
        setTeluguMovies([]);
      }
    };

    // Only show these on the main Home view (All).
    if (!isSearchingMovies && !isLanguageMode && filterType === 'all') {
      loadCurated();
    }
  }, [isSearchingMovies, isLanguageMode, filterType]);

  // Banner derived from Worldwide movies (popular page 1)
  const bannerItems =
    !isSearchingMovies && !isLanguageMode && filterType !== 'events'
      ? (movies || []).slice(0, 5).map((m) => ({ ...m, type: 'movie' }))
      : [];

  // Reset banner index when list changes
  useEffect(() => {
    setCurrentBannerIndex(0);
  }, [bannerItems.length, filterType, isSearchingMovies]);

  // Auto-rotate banner
  useEffect(() => {
    if (bannerItems.length <= 1) return;
    const t = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % bannerItems.length);
    }, 5000);
    return () => clearInterval(t);
  }, [bannerItems.length]);

  const goToPrevBanner = useCallback(() => {
    setCurrentBannerIndex((prev) => (prev === 0 ? bannerItems.length - 1 : prev - 1));
  }, [bannerItems.length]);

  const goToNextBanner = useCallback(() => {
    setCurrentBannerIndex((prev) => (prev + 1) % bannerItems.length);
  }, [bannerItems.length]);

  // Load events from backend once
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('https://show-time-backend-production.up.railway.app/api/events');
        if (!res.ok) {
          throw new Error('Failed to load events');
        }
        const data = await res.json();
        // Basic summary; full dates/zones will be fetched on selection
        const normalized = data.map(e => ({
          id: e.id,
          type: 'event',
          title: e.title,
          poster: e.posterUrl,
          venue: e.venue?.name || e.address || 'Event venue',
          address: e.address,
        }));
        setEvents(normalized);
      } catch (err) {
        console.error('Error loading events:', err);
        setEvents([]);
      }
    };
    loadEvents();
  }, []);

  // Store search history when user searches and fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      setRecommendedLoading(true);

      const movieFallback = (movies || [])
        .slice(0, 15)
        .map((m) => ({ ...m, type: 'movie' }));

      const eventFallback = (events || [])
        .slice(0, 15)
        .map((e) => ({
          id: e.id,
          title: e.title,
          poster: e.poster,
          venue: e.venue,
          type: 'event',
        }));

      try {
        if (filterType === 'events') {
          // For events filter, show events as recommendations
          setRecommendedMovies(eventFallback);
        } else {
          // For movies/all filter, use movie recommendations
          const searchHistory = JSON.parse(localStorage.getItem('movieSearchHistory') || '[]');

          if (searchHistory.length > 0) {
            // Get last searched movie ID and fetch recommendations
            const lastMovieId = searchHistory[searchHistory.length - 1];
            const recommendations = await getMovieRecommendations(lastMovieId);
            const recs = (recommendations || []).map((m) => ({ ...m, type: 'movie' }));
            setRecommendedMovies(recs.length ? recs : movieFallback);
          } else {
            // Fallback: show popular directly
            setRecommendedMovies(movieFallback);
          }
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setRecommendedMovies(filterType === 'events' ? eventFallback : movieFallback);
      } finally {
        setRecommendedLoading(false);
      }
    };

    // Only fetch if we have movies/events data loaded for fallbacks
    if (
      !isLanguageMode &&
      ((filterType !== 'events' && movies.length > 0) || (filterType === 'events' && events.length > 0))
    ) {
      fetchRecommendations();
    }
  }, [movies, filterType, events, isLanguageMode]);

  const recommendedDisplay =
    filterType === 'events'
      ? (recommendedMovies.length ? recommendedMovies : events.slice(0, 15).map((e) => ({ ...e, type: 'event' })))
      : (recommendedMovies.length ? recommendedMovies : movies.slice(0, 15).map((m) => ({ ...m, type: 'movie' })));

  // Save movie to search history when clicked
  const handleMovieClick = useCallback((movie) => {
    // Store in search history
    const searchHistory = JSON.parse(localStorage.getItem('movieSearchHistory') || '[]');
    // Add to history if not already there, keep last 10 movies
    const filtered = searchHistory.filter(id => id !== movie.id);
    filtered.push(movie.id);
    localStorage.setItem('movieSearchHistory', JSON.stringify(filtered.slice(-10)));

    // Call the original handler
    onMovieSelect(movie);
  }, [onMovieSelect]);

  // Combine and filter items
  const allItems = [
    ...movies.map(m => ({ ...m, type: 'movie' })),
    ...events
  ];

  const filteredItems = allItems
    .filter(item => {
      // Filter by type
      if (filterType === 'movies' && item.type !== 'movie') return false;
      if (filterType === 'events' && item.type !== 'event') return false;

      // If searching and filter is movies, TMDB search already handled it
      // But we still filter events locally if needed
      if (searchQuery && item.type === 'event') {
        return item.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'rating' && a.rating && b.rating) {
        return b.rating - a.rating;
      } else if (sortBy === 'latest' && a.releaseDate && b.releaseDate) {
        return new Date(b.releaseDate) - new Date(a.releaseDate);
      }
      return 0;
    });

  const filteredMovies = filteredItems.filter((i) => i.type === 'movie');
  const filteredEvents = filteredItems.filter((i) => i.type === 'event');

  // Search results rows (keep scroll rows; not for non-search home layout)
  const movieRows = Array.from({ length: 4 }, (_, rowIdx) =>
    filteredMovies.slice(rowIdx * 20, rowIdx * 20 + 20)
  ).filter((row) => row.length > 0);

  const worldwideMovies = (movies || []).slice(0, 15).map(m => ({ ...m, type: 'movie' }));

  return (
    <div className="min-h-screen bg-cinema-light">
      {/* Filters and Sort */}
      <div className="px-4 sm:px-8 py-4 bg-white border-b border-slate-200">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filter:</span>
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            {['all', 'movies', 'events'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filterType === type
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
                  }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-300 mx-2" />

          {/* Language (only when Movies filter is selected) */}
          {filterType === 'movies' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Language:</span>
              <select
                value={language}
                onChange={(e) => {
                  const next = e.target.value;
                  setLanguage(next);
                  if (next !== 'all') setSortBy('latest');
                }}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="te">Telugu</option>
                <option value="hi">Hindi</option>
                <option value="ta">Tamil</option>
                <option value="ml">Malayalam</option>
                <option value="kn">Kannada</option>
                <option value="en">English</option>
                <option value="ko">Korean</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          )}

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
            >
              <option value="name">Name (A-Z)</option>
              <option value="rating">Rating (High to Low)</option>
              <option value="latest">Latest First</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="ml-auto text-sm text-slate-500">
            {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
          </div>
        </motion.div>
      </div>

      {/* Banner Carousel (no extra TMDB calls) */}
      {!isSearchingMovies && !isLanguageMode && filterType !== 'events' && !loading && !error && bannerItems.length > 0 && (
        <div className="px-4 sm:px-8 py-4">
          <div className="relative w-full h-[360px] sm:h-[420px] md:h-[480px] overflow-hidden bg-black rounded-2xl">
            <AnimatePresence initial={false}>
              <motion.div
                key={bannerItems[currentBannerIndex]?.id}
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0"
              >
                {/* Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${bannerItems[currentBannerIndex]?.backdrop || bannerItems[currentBannerIndex]?.posterOriginal || bannerItems[currentBannerIndex]?.poster})`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Content */}
                <div className="absolute inset-0 flex items-end sm:items-center">
                  <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full pb-6 sm:pb-0">
                    <motion.div
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.45 }}
                      className="max-w-2xl"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full">
                          <span className="text-white text-xs font-bold uppercase tracking-wider">Featured</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/15 backdrop-blur-sm rounded-full">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-white text-sm font-semibold">{bannerItems[currentBannerIndex]?.rating}</span>
                        </div>
                      </div>

                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
                        {bannerItems[currentBannerIndex]?.title}
                      </h2>

                      <p className="text-slate-200 text-sm sm:text-base line-clamp-2 sm:line-clamp-3 mb-5 leading-relaxed">
                        {bannerItems[currentBannerIndex]?.overview || 'Explore this movie now.'}
                      </p>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleMovieClick(bannerItems[currentBannerIndex])}
                          className="flex items-center gap-2 px-6 py-3 font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white transition-all shadow-lg hover:scale-105 hover:shadow-violet-500/30"
                        >
                          <Play className="w-5 h-5 fill-white" />
                          View & Book
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            {bannerItems.length > 1 && (
              <>
                <button
                  onClick={goToPrevBanner}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={goToNextBanner}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recommended Movies Section */}
      {!isSearchingMovies && !isLanguageMode && recommendedDisplay.length > 0 && !recommendedLoading && (
        <div className="px-4 sm:px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${filterType === 'events'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}>
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">
                  {filterType === 'events' ? 'Featured Events' : 'Recommended For You'}
                </span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Horizontal Scroll Container */}
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {recommendedDisplay.map((item, index) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    onClick={() => item.type === 'event' ? onEventSelect(item) : handleMovieClick(item)}
                    onToggleWishlist={() => onToggleWishlist(item)}
                    isInWishlist={wishlist.some(w => w.id === item.id && w.type === item.type)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Recommended Loading Skeleton */}
      {!isSearchingMovies && !isLanguageMode && recommendedLoading && (
        <div className="px-4 sm:px-8 py-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-48 h-8 bg-slate-200 rounded-full animate-pulse" />
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[180px]">
                <div className="w-full aspect-[2/3] bg-slate-200 rounded-xl animate-pulse" />
                <div className="mt-2 h-4 bg-slate-200 rounded animate-pulse" />
                <div className="mt-1 h-3 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 sm:px-8 py-8">
        {/* Movies / Events */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Loading movies...</h3>
            <p className="text-slate-600">Fetching the latest from TMDB</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Error loading movies</h3>
            <p className="text-slate-600">{error}</p>
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">No results found</h3>
            <p className="text-slate-600">Try adjusting your search or filters</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {/* Curated rows (only when not searching) */}
            {!isSearchingMovies && !isLanguageMode && filterType === 'all' && (
              <div className="space-y-6 mb-8">
                {teluguMovies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500">
                        <span className="text-white text-sm font-bold">Telugu Movies</span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {teluguMovies.slice(0, 15).map((item, index) => (
                        <MovieCard
                          key={item.id}
                          item={item}
                          onClick={() => handleMovieClick(item)}
                          onToggleWishlist={() => onToggleWishlist(item)}
                          isInWishlist={wishlist.some(w => w.id === item.id && w.type === item.type)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {worldwideMovies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-700 to-slate-900">
                        <span className="text-white text-sm font-bold">Popular Movies</span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {worldwideMovies.slice(0, 15).map((item, index) => (
                        <MovieCard
                          key={item.id}
                          item={item}
                          onClick={() => handleMovieClick(item)}
                          onToggleWishlist={() => onToggleWishlist(item)}
                          isInWishlist={wishlist.some(w => w.id === item.id && w.type === item.type)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Language mode (Movies filter + language selected): show only recent releases */}
            {!isSearchingMovies && isLanguageMode && filterType === 'movies' && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600">
                    <span className="text-white text-sm font-bold">Recent Releases</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {filteredMovies.slice(0, 15).map((item, index) => (
                    <MovieCard
                      key={item.id}
                      item={item}
                      onClick={() => handleMovieClick(item)}
                      onToggleWishlist={() => onToggleWishlist(item)}
                      isInWishlist={wishlist.some(w => w.id === item.id && w.type === item.type)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Search mode: show only searched movies (no banners/recommended/curated) */}
            {isSearchingMovies && filterType !== 'events' && (
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500">
                    <span className="text-white text-sm font-bold">Search Results</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </div>
            )}

            {isSearchingMovies && filterType !== 'events' && movieRows.length > 0 && (
              <div className="space-y-6">
                {movieRows.map((row, rowIdx) => (
                  <div key={rowIdx} className="relative">
                    <div
                      className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {row.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex-shrink-0 w-[180px] sm:w-[200px] group cursor-pointer"
                          onClick={() => handleMovieClick(item)}
                        >
                          <div className="relative overflow-hidden rounded-lg bg-white transition-transform duration-300 hover:scale-105 shadow-lg">
                            {/* Wishlist Heart Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleWishlist({ ...item, type: item.type });
                              }}
                              className={`absolute top-2 left-2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all ${wishlist.some(w => w.id === item.id && w.type === item.type)
                                ? 'bg-red-500 text-white shadow-lg'
                                : 'bg-black/50 text-white hover:bg-red-500'
                                }`}
                            >
                              <Heart
                                className={`w-5 h-5 ${wishlist.some(w => w.id === item.id && w.type === item.type)
                                  ? 'fill-white'
                                  : ''
                                  }`}
                              />
                            </button>

                            <motion.img
                              layoutId={`poster-${item.id}`}
                              src={item.poster}
                              alt={item.title}
                              className="w-full aspect-[2/3] object-cover"
                            />

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                              <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                              <div className="flex items-center gap-2 mb-2">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span className="text-white text-sm">{item.rating}</span>
                                <span className="text-slate-300 text-sm">• {item.duration}</span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {(item.genre || []).map((g) => (
                                  <span key={g} className="text-xs px-2 py-1 bg-blue-600/30 text-blue-300 rounded">
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Info below poster */}
                          <div className="mt-3">
                            <h3 className="text-slate-900 font-semibold text-sm truncate">{item.title}</h3>
                            <p className="text-slate-600 text-xs mt-1">{(item.genre || []).join(', ')}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filterType === 'events' && (
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5 sm:gap-6">
                {filteredEvents.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group cursor-pointer"
                    onClick={() => onEventSelect(item)}
                  >
                    <div className="relative overflow-hidden rounded-lg bg-white transition-transform duration-300 hover:scale-105 shadow-lg">
                      <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                        Event
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWishlist({ ...item, type: item.type });
                        }}
                        className={`absolute top-2 left-2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all ${wishlist.some(w => w.id === item.id && w.type === item.type)
                          ? 'bg-red-500 text-white shadow-lg'
                          : 'bg-black/50 text-white hover:bg-red-500'
                          }`}
                      >
                        <Heart
                          className={`w-5 h-5 ${wishlist.some(w => w.id === item.id && w.type === item.type)
                            ? 'fill-white'
                            : ''
                            }`}
                        />
                      </button>

                      <motion.img
                        layoutId={`poster-${item.id}`}
                        src={item.poster}
                        alt={item.title}
                        className="w-full aspect-[2/3] object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-purple-300" />
                          <span className="text-white text-sm">{item.venue}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-purple-600/30 text-purple-300 rounded">Live Event</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-slate-900 font-semibold text-sm truncate">{item.title}</h3>
                      <p className="text-slate-600 text-xs mt-1">{item.venue}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Home;

