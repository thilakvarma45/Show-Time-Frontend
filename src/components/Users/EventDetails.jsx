import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import StarRating from '../common/StarRating';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Ticket,
    Loader2,
    ChevronRight,
    Clock,
    Users,
    Star
} from 'lucide-react';

import ReviewsList from '../common/ReviewsList';

const EventDetails = ({ onBookNow }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [otherEvents, setOtherEvents] = useState([]);
    const [zoneAvailability, setZoneAvailability] = useState({});

    // Rating states
    const [userRating, setUserRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [averageRating, setAverageRating] = useState(0);
    const [totalRatings, setTotalRatings] = useState(0);
    const [isRatingLoading, setIsRatingLoading] = useState(false);
    const [showReviews, setShowReviews] = useState(false);
    const [reviews, setReviews] = useState([]);

    // Scroll to top when component mounts or event ID changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [id]);

    const loadRatings = async (eventId) => {
        try {
            // 1. Get average rating (public)
            const summaryRes = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/event/${eventId}`);
            if (summaryRes.ok) {
                const summary = await summaryRes.json();
                setAverageRating(summary.averageRating);
                setTotalRatings(summary.totalRatings);
            }

            // 2. Get user's personal rating (if logged in)
            const token = localStorage.getItem('token');
            if (token) {
                const userRes = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/event/${eventId}/user`, {
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
        if (!event?.id) return;
        try {
            const res = await fetch(`https://show-time-backend-production.up.railway.app/api/ratings/event/${event.id}/reviews`);
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
            toast.error('Please login to rate events');
            return;
        }

        if (!event?.id) return;
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
                    itemId: event.id.toString(),
                    itemType: 'event',
                    rating: userRating,
                    review: reviewText
                })
            });

            if (!res.ok) throw new Error('Failed to submit rating');

            const data = await res.json();
            setUserRating(data.rating); // Ensure sync
            toast.success('Your review has been submitted!');

            // Refresh average ratings and reviews if open
            loadRatings(event.id.toString());
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

    // Fetch event details
    useEffect(() => {
        const loadEvent = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`https://show-time-backend-production.up.railway.app/api/events/${id}`);
                if (!res.ok) {
                    throw new Error('Failed to load event details');
                }
                const full = await res.json();

                // Load ratings immediately after event ID is known
                loadRatings(full.id.toString());

                let parsedConfig = {};
                try {
                    parsedConfig = full.eventConfig ? JSON.parse(full.eventConfig) : {};
                } catch (e) {
                    console.error('Failed to parse eventConfig', e);
                    parsedConfig = {};
                }

                const dates = Array.isArray(parsedConfig.dates) ? parsedConfig.dates : [];
                const zones = Array.isArray(parsedConfig.zones) ? parsedConfig.zones : [];

                const getZoneMinPrice = (zone) => {
                    const cats = Array.isArray(zone?.categories) ? zone.categories : [];
                    const prices = cats.map((c) => Number(c?.price)).filter((n) => Number.isFinite(n));
                    return prices.length ? Math.min(...prices) : null;
                };

                const normalizedEvent = {
                    id: full.id,
                    title: full.title,
                    description: full.description || '',
                    poster: full.posterUrl,
                    venue: full.venue?.name || '',
                    address: full.address || '',
                    dates: dates.map((d, idx) => ({
                        id: d?.id || `date_${idx + 1}`,
                        date: d?.date || '',
                        time: d?.time || '',
                    })),
                    zones: zones.map((z, idx) => ({
                        id: z?.id || `zone_${idx + 1}`,
                        name: z?.name || `Zone ${idx + 1}`,
                        capacity: Number(z?.capacity) || 0,
                        categories: Array.isArray(z?.categories) ? z.categories : [],
                        minPrice: getZoneMinPrice(z),
                    })),
                };

                setEvent(normalizedEvent);

                // Fetch live availability for the first date (so UI shows real remaining seats)
                const firstDateId = normalizedEvent.dates?.[0]?.id;
                if (firstDateId) {
                    try {
                        const availRes = await fetch(
                            `https://show-time-backend-production.up.railway.app/api/bookings/event/${full.id}/zone-availability?eventDateId=${encodeURIComponent(firstDateId)}`
                        );
                        if (availRes.ok) {
                            const avail = await availRes.json();
                            setZoneAvailability(avail || {});
                        } else {
                            setZoneAvailability({});
                        }
                    } catch (e) {
                        console.error('Failed to load zone availability', e);
                        setZoneAvailability({});
                    }
                } else {
                    setZoneAvailability({});
                }
            } catch (err) {
                console.error('Error loading event:', err);
                setError('Failed to load event details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadEvent();
        }
    }, [id]);

    // Fetch other events for recommendations
    useEffect(() => {
        const loadOtherEvents = async () => {
            try {
                const res = await fetch('https://show-time-backend-production.up.railway.app/api/events');
                if (!res.ok) {
                    throw new Error('Failed to load events');
                }
                const data = await res.json();
                // Filter out current event and take up to 6
                const filtered = data
                    .filter(e => e.id !== parseInt(id))
                    .slice(0, 6)
                    .map(e => ({
                        id: e.id,
                        title: e.title,
                        poster: e.posterUrl,
                        venue: e.venue?.name || e.address || 'Event venue',
                    }));
                setOtherEvents(filtered);
            } catch (err) {
                console.error('Error loading other events:', err);
                setOtherEvents([]);
            }
        };

        loadOtherEvents();
    }, [id]);

    const handleBookNow = () => {
        if (event && onBookNow) {
            onBookNow(event);
        }
    };

    const handleEventClick = (eventId) => {
        navigate(`/event/${eventId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
                    <p className="text-slate-600">Loading event details...</p>
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🎭</div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Event Not Found</h2>
                    <p className="text-slate-600 mb-6">{error || 'The event you are looking for does not exist.'}</p>
                    <button
                        onClick={() => navigate('/home')}
                        className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative mx-2.5 rounded-xl overflow-hidden">
                {/* Background with gradient */}
                <div
                    className="relative h-[50vh] min-h-[400px] bg-cover bg-center"
                    style={{
                        backgroundImage: event.poster
                            ? `url(${event.poster})`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/home')}
                        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back</span>
                    </button>

                    {/* Event Badge */}
                    <div className="absolute top-6 right-6 z-20 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold rounded-full uppercase tracking-wide">
                        Live Event
                    </div>

                    {/* Content Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                        <div className="max-w-7xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                    {event.title}
                                </h1>

                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                    <div className="flex items-center gap-2 text-white/90">
                                        <MapPin className="w-5 h-5" />
                                        <span>{event.venue || event.address || '—'}</span>
                                    </div>
                                    {event.dates.length > 0 && (
                                        <div className="flex items-center gap-2 text-white/90">
                                            <Calendar className="w-5 h-5" />
                                            <span>{event.dates.length} date{event.dates.length > 1 ? 's' : ''} available</span>
                                        </div>
                                    )}
                                    {event.zones.length > 0 && (
                                        <div className="flex items-center gap-2 text-white/90">
                                            <Users className="w-5 h-5" />
                                            <span>{event.zones.length} zone{event.zones.length > 1 ? 's' : ''}</span>
                                        </div>
                                    )}
                                </div>

                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    onClick={handleBookNow}
                                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/30 hover:scale-105 flex items-center gap-2"
                                >
                                    <Ticket className="w-5 h-5" />
                                    Book Tickets
                                    <ChevronRight className="w-5 h-5" />
                                </motion.button>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Description */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">About This Event</h2>
                            <p className="text-slate-700 text-lg leading-relaxed">
                                {event.description || '—'}
                            </p>
                        </motion.section>

                        {/* Available Dates */}
                        {event.dates.length > 0 && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Calendar className="w-6 h-6" />
                                    Available Dates
                                </h2>
                                <div className="flex flex-wrap gap-3">
                                    {event.dates.map((date, index) => (
                                        <div
                                            key={index}
                                            className="px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 font-medium flex items-center gap-2"
                                        >
                                            <Clock className="w-4 h-4" />
                                            {date.date} {date.time && `at ${date.time}`}
                                        </div>
                                    ))}
                                </div>
                            </motion.section>
                        )}

                        {/* Zone Information */}
                        {event.zones.length > 0 && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Ticket className="w-6 h-6" />
                                    Ticket Zones
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {event.zones.map((zone, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
                                        >
                                            <h3 className="font-semibold text-slate-900 mb-1">{zone.name}</h3>
                                            <p className="text-purple-600 font-bold text-lg">
                                                ₹{Number.isFinite(zone.minPrice) && zone.minPrice !== null ? zone.minPrice : 0}
                                            </p>

                                            {zone.categories?.length > 0 && (
                                                <div className="text-slate-600 text-sm mt-1">
                                                    {zone.categories
                                                        .filter((c) => c?.type)
                                                        .map((c) => `${c.type}: ₹${Number(c.price) || 0}`)
                                                        .join(' • ')}
                                                </div>
                                            )}

                                            <p className="text-slate-500 text-sm mt-1">
                                                {zoneAvailability?.[zone.name]
                                                    ? `${zoneAvailability[zone.name].available} seats available`
                                                    : `${zone.capacity || 0} seats available`}
                                            </p>
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
                            transition={{ delay: 0.3 }}
                            className="bg-slate-50 rounded-xl p-6 space-y-6 sticky top-24"
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Event Info</h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Venue</p>
                                        <p className="font-semibold text-slate-900">{event.venue}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Address</p>
                                        <p className="font-semibold text-slate-900">{event.address}</p>
                                    </div>
                                    {event.dates.length > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-500 mb-1">Dates Available</p>
                                            <p className="font-semibold text-slate-900">{event.dates.length} date{event.dates.length > 1 ? 's' : ''}</p>
                                        </div>
                                    )}
                                    {event.zones.length > 0 && (
                                        null
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleBookNow}
                                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg hover:scale-105"
                            >
                                Book Tickets Now
                            </button>

                            {/* User Rating Section */}
                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-slate-500 font-medium uppercase">Community Rating</p>
                                    <button
                                        onClick={handleOpenReviews}
                                        className="text-xs text-purple-600 font-medium hover:underline"
                                    >
                                        View Reviews
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                        <span className="font-bold text-slate-900 text-lg">
                                            {totalRatings > 0 ? `${averageRating}/5` : 'New'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        ({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})
                                    </span>
                                </div>

                                <p className="text-xs text-slate-500 mb-2 font-medium">Rate this Event</p>
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
                                        className="w-full mt-3 p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px]"
                                    />

                                    <button
                                        onClick={submitRating}
                                        disabled={isRatingLoading || userRating === 0}
                                        className={`mt-3 w-full py-2 rounded-md text-sm font-medium transition-colors ${isRatingLoading || userRating === 0
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                            }`}
                                    >
                                        {isRatingLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (userRating > 0 ? 'Update Review' : 'Submit Review')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Recommendations Section - Other Events */}
                {otherEvents.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-12"
                    >
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Ticket className="w-6 h-6" />
                            You Might Also Like
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {otherEvents.map((evt) => (
                                <div
                                    key={evt.id}
                                    onClick={() => handleEventClick(evt.id)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative overflow-hidden rounded-lg bg-slate-200 shadow-md hover:shadow-xl transition-all">
                                        {evt.poster ? (
                                            <img
                                                src={evt.poster}
                                                alt={evt.title}
                                                className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full aspect-[2/3] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                                <Ticket className="w-12 h-12 text-white/70" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                                            Event
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                            <p className="text-white text-sm font-medium">{evt.venue}</p>
                                        </div>
                                    </div>
                                    <h3 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                        {evt.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{evt.venue}</p>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                )}
            </div>

            {/* Reviews Modal */}
            <ReviewsList
                isOpen={showReviews}
                onClose={() => setShowReviews(false)}
                reviews={reviews}
                title={event.title}
            />
        </div>
    );
};

export default EventDetails;

