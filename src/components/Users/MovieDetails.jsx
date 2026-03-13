import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import StarRating from '../common/StarRating';
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  Users,
  Film,
  Loader2,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import { getMovieById, getMovieRecommendations } from '../../services/tmdb';

import ReviewsList from '../common/ReviewsList';

const MovieDetails = ({ onBookNow }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [hasShows, setHasShows] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  // Rating states
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState([]);

  // Scroll to top when component mounts or movie ID changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    const loadMovie = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMovieById(id);
        setMovie(data);

        // Load ratings only after movie is loaded
        if (data && data.id) {
          loadRatings(data.id.toString());
        }
      } catch (err) {
        console.error('Error loading movie:', err);
        setError('Failed to load movie details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadMovie();
    }
  }, [id]);

  const loadRatings = async (movieId) => {
    try {
      // 1. Get average rating (public)
      const summaryRes = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/movie/${movieId}`);
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        setAverageRating(summary.averageRating);
        setTotalRatings(summary.totalRatings);
      }

      // 2. Get user's personal rating (if logged in)
      const token = localStorage.getItem('token');
      if (token) {
        const userRes = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/movie/${movieId}/user`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.hasRated) {
            setUserRating(userData.rating);
            setReviewText(userData.review || '');
          } else {
            setUserRating(0);
            setReviewText('');
          }
        }
      }
    } catch (e) {
      console.error("Failed to load ratings", e);
    }
  };

  const loadReviewsList = async () => {
    if (!movie?.id) return;
    try {
      const res = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/movie/${movie.id}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (e) {
      console.error("Failed to load reviews list", e);
    }
  };

  const handleOpenReviews = () => {
    loadReviewsList();
    setShowReviews(true);
  };

  const submitRating = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to rate movies');
      return;
    }

    if (!movie?.id) return;
    if (userRating === 0) {
      toast.warning('Please select a star rating');
      return;
    }

    setIsRatingLoading(true);
    try {
      const res = await fetch('https://show-time-backend-production.up.railway.app/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemId: movie.id.toString(),
          itemType: 'movie',
          rating: userRating,
          review: reviewText
        })
      });

      if (!res.ok) throw new Error('Failed to submit rating');

      const data = await res.json();
      setUserRating(data.rating); // Ensure sync
      toast.success('Your review has been submitted!');

      // Refresh average ratings and reviews if open
      loadRatings(movie.id.toString());
      if (showReviews) {
        loadReviewsList();
      }
    } catch (e) {
      console.error('Rating submission error', e);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setIsRatingLoading(false);
    }
  };

  // Check if there are any shows scheduled for THIS specific movie
  useEffect(() => {
    const checkMovieShows = async () => {
      if (!movie || !movie.id) return;

      try {
        // Check if this movie has any shows scheduled
      const res = await fetch('https://show-time-backend-production.up.railway.app/api/shows/summary');
        if (!res.ok) {
          throw new Error('Failed to load shows');
        }
        const summaries = await res.json();
        // Check if this movie (tmdbMovieId) has any shows
        const movieHasShows = summaries.some(
          (summary) => summary.tmdbMovieId === movie.id
        );
        setHasShows(movieHasShows);
      } catch (e) {
        console.error('Error checking movie shows:', e);
        // On error, allow booking to avoid blocking the user
        setHasShows(true);
      }
    };

    checkMovieShows();
  }, [movie]);

  // Load recommendations for this movie
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!movie || !movie.id) {
        setRecommendations([]);
        return;
      }

      try {
        const recs = await getMovieRecommendations(movie.id);
        setRecommendations(recs);
      } catch (err) {
        console.error('Error loading recommendations:', err);
        setRecommendations([]);
      }
    };

    loadRecommendations();
  }, [movie]);

  const handleBookNow = () => {
    if (!hasShows) return;
    if (movie && onBookNow) {
      onBookNow(movie);
      navigate('/booking/movie', { state: { movie } });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading movie details...</p>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Movie Not Found</h2>
          <p className="text-slate-600 mb-6">{error || 'The movie you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Backdrop Hero Section */}
      <div className={`relative mx-2.5 rounded-lg ${movie.backdrop ? 'h-[60vh] min-h-[500px]' : 'h-auto pt-24 pb-12 bg-gradient-to-br from-slate-50 to-white'} overflow-hidden`}>
        {movie.backdrop ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${movie.backdrop})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white" />
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate('/home')}
          className={`absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm transition-all ${movie.backdrop
            ? 'bg-black/50 hover:bg-black/70 text-white'
            : 'bg-white/90 hover:bg-white text-slate-900 border border-slate-200'
            }`}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        {/* Movie Info Overlay - Moved down to not cover back button */}
        <div className={`relative ${movie.backdrop ? 'absolute bottom-0 left-0 right-0 pt-20 p-8 text-white' : 'relative p-8 pt-24 text-slate-900'}`}>
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row gap-6 items-start"
            >
              {/* Poster */}
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                src={movie.poster}
                alt={movie.title}
                className="w-48 h-72 object-cover rounded-lg shadow-2xl"
              />

              {/* Info */}
              <div className="flex-1">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`text-4xl md:text-5xl font-bold mb-4 ${movie.backdrop ? 'text-white' : 'text-slate-900'}`}
                >
                  {movie.title}
                </motion.h1>

                {movie.tagline && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className={`text-xl italic mb-4 ${movie.backdrop ? 'text-white/90' : 'text-slate-600'}`}
                  >
                    {movie.tagline}
                  </motion.p>
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap items-center gap-4 mb-6"
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className={`text-lg font-semibold ${movie.backdrop ? 'text-white' : 'text-slate-900'}`}>{movie.rating}/5</span>
                    <span className={movie.backdrop ? 'text-white/70' : 'text-slate-600'}>({movie.voteCount} votes)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${movie.backdrop ? 'text-white' : 'text-slate-700'}`}>
                    <Clock className="w-5 h-5" />
                    <span>{movie.duration}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${movie.backdrop ? 'text-white' : 'text-slate-700'}`}>
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(movie.releaseDate)}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-wrap gap-2 mb-6"
                >
                  {movie.genre && movie.genre.map((genre, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${movie.backdrop
                        ? 'bg-white/20 backdrop-blur-sm border border-white/30 text-white'
                        : 'bg-blue-100 border border-blue-200 text-blue-700'
                        }`}
                    >
                      {genre}
                    </span>
                  ))}
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={handleBookNow}
                  disabled={!hasShows}
                  className={`px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-lg flex items-center gap-2 ${hasShows
                    ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  <Film className="w-5 h-5" />
                  {hasShows ? 'Book Now' : 'Not Available'}
                  {hasShows && <ChevronRight className="w-5 h-5" />}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview */}
        {movie.overview && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
            <p className="text-slate-700 text-lg leading-relaxed max-w-3xl">
              {movie.overview}
            </p>
          </motion.section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Cast */}
            {movie.cast && movie.cast.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Cast
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {movie.cast.map((actor) => (
                    <div key={actor.id} className="text-center">
                      <div className="w-full aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-slate-200">
                        {actor.profilePath ? (
                          <img
                            src={actor.profilePath}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Users className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{actor.name}</p>
                      <p className="text-slate-600 text-xs">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Crew */}
            {movie.crew && movie.crew.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Crew</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {movie.crew.map((person) => (
                    <div key={person.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      {person.profilePath ? (
                        <img
                          src={person.profilePath}
                          alt={person.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center">
                          <Users className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{person.name}</p>
                        <p className="text-slate-600 text-sm">{person.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Images Gallery */}
            {movie.images && movie.images.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6" />
                  Images
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {movie.images.map((img, index) => (
                    <div
                      key={index}
                      className="aspect-video rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={img.path}
                        alt={`${movie.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 space-y-6 sticky top-24"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Movie Info</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Release Date</p>
                    <p className="font-semibold text-slate-900">{formatDate(movie.releaseDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Runtime</p>
                    <p className="font-semibold text-slate-900">{movie.duration}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-500">Community Rating</p>
                      <button
                        onClick={handleOpenReviews}
                        className="text-xs text-blue-600 font-medium hover:underline"
                      >
                        View Reviews
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold text-slate-900">
                        {totalRatings > 0 ? `${averageRating}/5` : 'New'}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  </div>

                  {/* User Rating Section */}
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-medium uppercase">Your Review</p>
                    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col items-center">
                      <StarRating
                        rating={userRating}
                        onRate={setUserRating}
                        showLabel={true}
                        size="lg"
                      />

                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Write your review here..."
                        className="w-full mt-3 p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                      />

                      <button
                        onClick={submitRating}
                        disabled={isRatingLoading || userRating === 0}
                        className={`mt-3 w-full py-2 rounded-md text-sm font-medium transition-colors ${isRatingLoading || userRating === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                      >
                        {isRatingLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (userRating > 0 ? 'Update Review' : 'Submit Review')}
                      </button>
                    </div>
                  </div>

                  {movie.status && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Status</p>
                      <p className="font-semibold text-slate-900">{movie.status}</p>
                    </div>
                  )}
                </div>
              </div>

              {movie.budget > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Box Office</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Budget</p>
                      <p className="font-semibold text-slate-900">{formatCurrency(movie.budget)}</p>
                    </div>
                    {movie.revenue > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Revenue</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(movie.revenue)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleBookNow}
                disabled={!hasShows}
                className={`w-full px-6 py-3 rounded-lg font-bold transition-all shadow-md ${hasShows
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {hasShows ? 'Book Tickets' : 'Not Available'}
              </button>
            </motion.div>
          </div>
        </div>

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Film className="w-6 h-6" />
              You Might Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/movie/${rec.id}`)}
                  className="group cursor-pointer"
                >
                  <div className="relative overflow-hidden rounded-lg bg-slate-200 shadow-md hover:shadow-xl transition-all">
                    <img
                      src={rec.poster}
                      alt={rec.title}
                      className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-white text-xs font-medium">{rec.rating}</span>
                      </div>
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.genre?.slice(0, 2).join(', ')}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* Image Modal */}
      {selectedImageIndex !== null && movie.images && movie.images[selectedImageIndex] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-6 right-6 text-white text-2xl font-bold"
          // ... (rest of image modal)
          >
            ×
          </button>
          <img
            src={movie.images[selectedImageIndex].path}
            alt={`${movie.title} ${selectedImageIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Reviews Modal */}
      <ReviewsList
        isOpen={showReviews}
        onClose={() => setShowReviews(false)}
        reviews={reviews}
        title={movie.title}
      />
    </div>
  );
};

export default MovieDetails;

