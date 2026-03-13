
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2, Search, Upload, Image as ImageIcon, ChevronDown, CheckCircle, Building2, Film, Calendar, X } from 'lucide-react';
import CustomDatePicker from '../UI/CustomDatePicker';
import { searchMovies } from '../../services/tmdb';
import { toast } from 'react-toastify';

const SmartScheduler = ({ owner }) => {
  const [activeTab, setActiveTab] = useState('MOVIE'); // 'MOVIE' | 'EVENT'
  const [movieResults, setMovieResults] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieDropdownOpen, setMovieDropdownOpen] = useState(false);

  // Movie scheduling state
  const [movieForm, setMovieForm] = useState({
    venueId: '',
    movieId: '',
    // scheduling window
    schedulePreset: '7', // '7' | '14' | 'custom'
    startDate: '',
    endDate: '',
    // show times
    confirmedShows: [],
    customTime: '',
    // pricing
    goldPrice: '',
    silverPrice: '',
    vipPrice: ''
  });

  // Search movies from TMDB while typing (debounced)
  useEffect(() => {
    const loadMovies = async () => {
      try {
        const q = movieSearchQuery.trim();
        if (!q) {
          setMovieResults([]);
          setLoadingMovies(false);
          return;
        }

        setLoadingMovies(true);
        const result = await searchMovies(q, 1);
        setMovieResults(result?.movies || []);
      } catch (err) {
        console.error('Error loading movies:', err);
        setMovieResults([]);
      } finally {
        setLoadingMovies(false);
      }
    };

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      loadMovies();
    }, movieSearchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [movieSearchQuery]);

  // Event scheduling state
  const [eventForm, setEventForm] = useState({
    venueId: '',
    eventName: '',
    artist: '',
    imageUrl: '',
    description: '',
    address: '',
    dates: [],
    zones: []
  });

  const [eventImageFile, setEventImageFile] = useState(null);
  const [eventImagePreview, setEventImagePreview] = useState(null);
  const [uploadingEventImage, setUploadingEventImage] = useState(false);

  // Suggested time slots
  const suggestedSlots = ['11:30 AM', '02:30 PM', '06:30 PM', '09:30 PM'];

  // Venues will be provided from backend / owner context instead of mock data
  const [venues, setVenues] = useState([]);

  // Filter venues by type (backend uses enum THEATRE / EVENT_GROUND)
  const theatreVenues = venues.filter(v => {
    const t = (v.type || '').toString().toUpperCase();
    return t === 'THEATRE';
  });
  const eventVenues = venues.filter(v => {
    const t = (v.type || '').toString().toUpperCase();
    return t === 'EVENT_GROUND';
  });

  // Load venues for this owner (if provided)
  useEffect(() => {
    const loadVenues = async () => {
      try {
        if (!owner?.id) {
          setVenues([]);
          return;
        }
        const token = localStorage.getItem('token');
        const res = await fetch(`https://show-time-backend-production.up.railway.app/api/venues/owner/${owner.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error('Failed to load venues');
        }
        const data = await res.json();
        setVenues(data);
      } catch (err) {
        console.error('Error loading venues:', err);
        setVenues([]);
      }
    };
    loadVenues();
  }, [owner]);

  // Helper to calculate end date for 7/14 presets
  const calculateEndDate = (start, days) => {
    if (!start) return '';
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) return '';
    const end = new Date(startDate);
    end.setDate(startDate.getDate() + (days - 1));
    return end.toISOString().split('T')[0];
  };

  // Movie form handlers
  const handleMovieInputChange = (e) => {
    const { name, value } = e.target;
    // When changing the preset, auto-update endDate if we already have a startDate
    if (name === 'schedulePreset') {
      if (value === '7' || value === '14') {
        setMovieForm(prev => {
          const days = value === '7' ? 7 : 14;
          const newEnd = calculateEndDate(prev.startDate || new Date().toISOString().split('T')[0], days);
          return {
            ...prev,
            schedulePreset: value,
            startDate: prev.startDate || new Date().toISOString().split('T')[0],
            endDate: newEnd
          };
        });
      } else {
        // custom - keep dates as-is, user will pick both
        setMovieForm(prev => ({ ...prev, schedulePreset: value }));
      }
      return;
    }

    if (name === 'startDate') {
      setMovieForm(prev => {
        // If preset is 7 or 14, recompute endDate automatically
        if (prev.schedulePreset === '7' || prev.schedulePreset === '14') {
          const days = prev.schedulePreset === '7' ? 7 : 14;
          return {
            ...prev,
            startDate: value,
            endDate: calculateEndDate(value, days)
          };
        }
        return { ...prev, startDate: value };
      });
      return;
    }

    setMovieForm(prev => ({ ...prev, [name]: value }));
  };

  const addSuggestedSlot = (slot) => {
    if (!movieForm.confirmedShows.includes(slot)) {
      setMovieForm(prev => ({
        ...prev,
        confirmedShows: [...prev.confirmedShows, slot]
      }));
    }
  };

  const removeShow = (slot) => {
    setMovieForm(prev => ({
      ...prev,
      confirmedShows: prev.confirmedShows.filter(s => s !== slot)
    }));
  };

  const handleCustomTimeSubmit = (e) => {
    e.preventDefault();
    if (movieForm.customTime && !movieForm.confirmedShows.includes(movieForm.customTime)) {
      setMovieForm(prev => ({
        ...prev,
        confirmedShows: [...prev.confirmedShows, prev.customTime],
        customTime: ''
      }));
    }
  };

  const handleMovieSubmit = async (e) => {
    e.preventDefault();

    if (!movieForm.venueId || !movieForm.movieId) {
      toast.error('Please select both a venue and a movie.');
      return;
    }
    if (!movieForm.startDate || !movieForm.endDate) {
      toast.error('Please select a valid start and end date.');
      return;
    }
    if (movieForm.confirmedShows.length === 0) {
      toast.error('Please add at least one show time.');
      return;
    }

    try {
      const payload = {
        venueId: Number(movieForm.venueId),
        tmdbMovieId: Number(movieForm.movieId),
        startDate: movieForm.startDate,
        endDate: movieForm.endDate,
        showtimes: movieForm.confirmedShows,
        silverPrice: Number(movieForm.silverPrice || 0),
        goldPrice: Number(movieForm.goldPrice || 0),
        vipPrice: Number(movieForm.vipPrice || 0),
      };

      const token = localStorage.getItem('token');
      const res = await fetch('https://show-time-backend-production.up.railway.app/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Failed to create schedule:', text);
        toast.error('Failed to create movie schedule. Please check backend logs.');
        return;
      }

      const data = await res.json();
      toast.success(`Movie schedule created! Schedule #${data.scheduleId} • Shows: ${data.generatedShowCount}`);

      setMovieForm({
        venueId: '',
        movieId: '',
        schedulePreset: '7',
        startDate: '',
        endDate: '',
        confirmedShows: [],
        customTime: '',
        goldPrice: '',
        silverPrice: '',
        vipPrice: ''
      });
    } catch (err) {
      console.error('Error calling schedule API:', err);
      toast.error('Unexpected error while creating schedule. See console for details.');
    }
  };

  // Event form handlers
  const handleEventInputChange = (e) => {
    const { name, value } = e.target;
    setEventForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEventImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setEventImageFile(file);
      setEventImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadEventImage = async () => {
    if (!eventImageFile) return null;

    setUploadingEventImage(true);
    try {
      const formData = new FormData();
      formData.append('image', eventImageFile);

      const token = localStorage.getItem('token');
      const response = await fetch('https://show-time-backend-production.up.railway.app/api/upload/event', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      return `https://show-time-backend-production.up.railway.app${data.imageUrl}`;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploadingEventImage(false);
    }
  };

  // Date management for events
  const addDate = () => {
    const dateId = `date_${Date.now()}`;
    setEventForm(prev => ({
      ...prev,
      dates: [...prev.dates, { id: dateId, date: '', time: '' }]
    }));
  };

  const updateDate = (dateId, field, value) => {
    setEventForm(prev => ({
      ...prev,
      dates: prev.dates.map(date =>
        date.id === dateId ? { ...date, [field]: value } : date
      )
    }));
  };

  const removeDate = (dateId) => {
    setEventForm(prev => ({
      ...prev,
      dates: prev.dates.filter(date => date.id !== dateId)
    }));
  };

  const addZone = () => {
    setEventForm(prev => ({
      ...prev,
      zones: [...prev.zones, {
        id: `zone_${Date.now()}`,
        name: '',
        capacity: '',
        adultPrice: '',
        childrenPrice: ''
      }]
    }));
  };

  const updateZone = (zoneId, field, value) => {
    setEventForm(prev => ({
      ...prev,
      zones: prev.zones.map(zone =>
        zone.id === zoneId ? { ...zone, [field]: value } : zone
      )
    }));
  };

  const removeZone = (zoneId) => {
    setEventForm(prev => ({
      ...prev,
      zones: prev.zones.filter(zone => zone.id !== zoneId)
    }));
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();

    if (!owner?.id) {
      toast.error('Owner information is missing. Please refresh and try again.');
      return;
    }

    if (eventForm.dates.length === 0) {
      toast.error('Please add at least one date for the event.');
      return;
    }

    if (eventForm.zones.length === 0) {
      toast.error('Please add at least one zone for the event.');
      return;
    }

    try {
      // Upload image first if file is selected
      let uploadedImageUrl = eventForm.imageUrl;
      if (eventImageFile) {
        uploadedImageUrl = await uploadEventImage();
        if (!uploadedImageUrl) {
          toast.error('Failed to upload event image');
          return;
        }
      }

      // Get venue to get address if not provided
      const selectedVenue = eventVenues.find(v => v.id === Number(eventForm.venueId));
      if (!selectedVenue) {
        toast.error('Please select a valid venue.');
        return;
      }

      // Build eventConfig JSON matching frontend expectations
      const zoneColors = [
        'border-purple-500',
        'border-pink-500',
        'border-yellow-500',
        'border-blue-500',
        'border-green-500',
        'border-red-500'
      ];

      const eventConfig = {
        dates: eventForm.dates.map((d, idx) => ({
          id: d.id || `date_${idx + 1}`,
          label: d.date && d.time
            ? `${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} | ${d.time}`
            : d.date || `Date ${idx + 1}`,
          date: d.date,
          time: d.time || ''
        })),
        zones: eventForm.zones.map((z, idx) => ({
          id: z.id || `zone_${idx + 1}`,
          name: z.name || `Zone ${idx + 1}`,
          capacity: Number(z.capacity) || 0,
          color: zoneColors[idx % zoneColors.length], // Assign color for UI
          categories: [
            { type: 'Adult', price: Number(z.adultPrice) || 0 },
            { type: 'Children', price: Number(z.childrenPrice) || 0 }
          ]
        }))
      };

      const token = localStorage.getItem('token');
      const response = await fetch('https://show-time-backend-production.up.railway.app/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ownerId: owner.id,
          venueId: Number(eventForm.venueId),
          title: eventForm.eventName,
          description: eventForm.artist || eventForm.description || '',
          posterUrl: uploadedImageUrl || '',
          address: eventForm.address || selectedVenue.address || selectedVenue.location || '',
          eventConfig: JSON.stringify(eventConfig)
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Failed to create event:', text);
        toast.error('Failed to create event. Please check backend logs.');
        return;
      }

      const data = await response.json();
      toast.success(`Event "${eventForm.eventName}" created successfully!`);

      // Reset form and image states
      setEventImageFile(null);
      setEventImagePreview(null);
      setEventForm({
        venueId: '',
        eventName: '',
        artist: '',
        imageUrl: '',
        description: '',
        address: '',
        dates: [],
        zones: []
      });
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error('Unexpected error while creating event. See console for details.');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Smart Scheduler</h1>
          <p className="text-slate-500 font-medium mt-1">Manage performance schedules and special events.</p>
        </div>

        {/* Tabs */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex w-full md:w-auto self-start">
          <button
            onClick={() => setActiveTab('MOVIE')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'MOVIE'
              ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <Film className={`w-4 h-4 ${activeTab === 'MOVIE' ? 'text-indigo-600' : 'text-slate-400'}`} />
            Schedule Movie
          </button>
          <button
            onClick={() => setActiveTab('EVENT')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'EVENT'
              ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <Calendar className={`w-4 h-4 ${activeTab === 'EVENT' ? 'text-indigo-600' : 'text-slate-400'}`} />
            Create Event
          </button>
        </div>
      </div>

      {/* Movie Scheduling Form */}
      {activeTab === 'MOVIE' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl shadow-slate-200/50"
        >
          <form onSubmit={handleMovieSubmit} className="space-y-8">
            {/* Step 1: Select Venue */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">1</span>
                Select Venue
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  name="venueId"
                  value={movieForm.venueId}
                  onChange={handleMovieInputChange}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                >
                  <option value="">Choose a theatre...</option>
                  {theatreVenues.map(venue => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.location} (Capacity: {venue.capacity})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Step 2: Search and Select Movie */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">2</span>
                Select Movie
              </label>

              {/* Movie Search + Dropdown */}
              <div className="relative z-20">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search TMDB movies..."
                  value={movieSearchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setMovieSearchQuery(next);
                    setMovieForm((prev) => ({ ...prev, movieId: '' }));
                    setMovieDropdownOpen(true);
                  }}
                  onFocus={() => setMovieDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setMovieDropdownOpen(false), 150);
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                />

                {movieSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setMovieSearchQuery('');
                      setMovieForm((prev) => ({ ...prev, movieId: '' }));
                      setMovieResults([]);
                      setMovieDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Dropdown */}
                {movieDropdownOpen && movieSearchQuery.trim() && (
                  <div className="absolute mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                    {loadingMovies ? (
                      <div className="px-6 py-8 flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-sm font-medium">Searching TMDB...</span>
                      </div>
                    ) : movieResults.length === 0 ? (
                      <div className="px-6 py-8 text-center text-slate-500 font-medium">
                        No movies found.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {movieResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setMovieForm((prev) => ({ ...prev, movieId: String(m.id) }));
                              setMovieSearchQuery(m.title);
                              setMovieDropdownOpen(false);
                            }}
                            className="w-full text-left px-6 py-4 hover:bg-indigo-50/50 flex items-center gap-4 transition-colors group"
                          >
                            <div className="w-10 h-14 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                              {m.poster ? (
                                <img src={m.poster} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400"><Film className="w-4 h-4" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 text-lg truncate group-hover:text-indigo-700 transition-colors">{m.title}</div>
                              <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-medium">{m.releaseDate ? m.releaseDate.split('-')[0] : 'TBA'}</span>
                                <span className="mx-1.5 opacity-30">•</span>
                                <span className="font-medium">{m.duration || 'N/A'}</span>
                                {m.rating > 0 && (
                                  <>
                                    <span className="mx-1.5 opacity-30">•</span>
                                    <span className="text-amber-500 font-bold flex items-center gap-1">★ {m.rating}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {movieForm.movieId === String(m.id) && <div className="text-indigo-600 font-bold text-sm">Selected</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {movieForm.movieId && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-3 h-3" /></div>
                  Movie Selected (ID: {movieForm.movieId})
                </div>
              )}
            </div>

            {/* Step 3: Schedule */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">3</span>
                Schedule Dates
              </label>

              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: '7', label: 'Next 7 Days' },
                    { val: '14', label: 'Next 14 Days' },
                    { val: 'custom', label: 'Custom Range' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handleMovieInputChange({ target: { name: 'schedulePreset', value: opt.val } })}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${movieForm.schedulePreset === opt.val
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-600 ring-offset-2'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <CustomDatePicker
                      label="Start Date"
                      value={movieForm.startDate}
                      onChange={(e) => handleMovieInputChange({ target: { name: 'startDate', value: e.target.value } })}
                      minDate={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <CustomDatePicker
                      label="End Date"
                      value={movieForm.endDate}
                      onChange={(e) => handleMovieInputChange({ target: { name: 'endDate', value: e.target.value } })}
                      minDate={movieForm.startDate || new Date().toISOString().split('T')[0]}
                      required
                      className={movieForm.schedulePreset !== 'custom' ? 'opacity-60 pointer-events-none' : ''}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Time Slots */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">4</span>
                Show Times
              </label>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {suggestedSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => addSuggestedSlot(slot)}
                      disabled={movieForm.confirmedShows.includes(slot)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${movieForm.confirmedShows.includes(slot)
                        ? 'bg-indigo-50 text-indigo-300 cursor-not-allowed hidden'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                    >
                      + {slot}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 max-w-sm">
                  <input
                    type="text"
                    value={movieForm.customTime}
                    onChange={(e) => setMovieForm(prev => ({ ...prev, customTime: e.target.value }))}
                    placeholder="Custom time (e.g. 10:00 AM)"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleCustomTimeSubmit(e)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>

                {/* Confirmed Chips */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {movieForm.confirmedShows.length === 0 && (
                    <span className="text-sm text-slate-400 italic">No showtimes selected yet.</span>
                  )}
                  {movieForm.confirmedShows.map(slot => (
                    <span key={slot} className="pl-3 pr-2 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm animate-in zoom-in duration-200">
                      {slot}
                      <button type="button" onClick={() => removeShow(slot)} className="hover:text-indigo-200"><X className="w-4 h-4" /></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 5: Pricing */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">5</span>
                Set Pricing (₹)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['goldPrice', 'silverPrice', 'vipPrice'].map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{field.replace('Price', ' Class')}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        name={field}
                        value={movieForm[field]}
                        onChange={handleMovieInputChange}
                        required
                        min="0"
                        placeholder="0"
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-black text-lg shadow-xl shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Publish Schedule
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Event Scheduling Form */}
      {activeTab === 'EVENT' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xl shadow-slate-200/50"
        >
          <form onSubmit={handleEventSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Event Title</label>
                  <input
                    type="text"
                    name="eventName"
                    value={eventForm.eventName}
                    onChange={handleEventInputChange}
                    placeholder="e.g. Comedy Night 2024"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Artist / Performer</label>
                  <input
                    type="text"
                    name="artist"
                    value={eventForm.artist}
                    onChange={handleEventInputChange}
                    placeholder="e.g. Zakir Khan"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                  <textarea
                    name="description"
                    value={eventForm.description}
                    onChange={handleEventInputChange}
                    placeholder="Event details..."
                    rows="4"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Venue</label>
                  <select
                    name="venueId"
                    value={eventForm.venueId}
                    onChange={handleEventInputChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    <option value="">Choose an event ground...</option>
                    {eventVenues.map(venue => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name} - {venue.location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column (Image) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Event Poster</label>
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 hover:bg-slate-50 transition-colors bg-white relative overflow-hidden group">
                  {eventImagePreview ? (
                    <>
                      <img src={eventImagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-bold text-sm">Click to change</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <span className="text-sm font-bold">Upload Poster Image</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEventImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {uploadingEventImage && <p className="text-xs text-indigo-600 font-bold text-center animate-pulse">Uploading image...</p>}
              </div>
            </div>

            {/* Dates Manager */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-900 uppercase">Event Schedule</label>
                <button type="button" onClick={addDate} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Date
                </button>
              </div>

              {eventForm.dates.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                  No dates added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {eventForm.dates.map((date, index) => (
                    <div key={date.id} className="flex gap-4 items-start animate-in slide-in-from-left-2 fade-in">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 mt-2">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CustomDatePicker
                          value={date.date}
                          onChange={(e) => updateDate(date.id, 'date', e.target.value)}
                          minDate={new Date().toISOString().split('T')[0]}
                          required
                        />
                        <input
                          type="time"
                          value={date.time}
                          onChange={(e) => updateDate(date.id, 'time', e.target.value)}
                          required
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button type="button" onClick={() => removeDate(date.id)} className="p-2 text-slate-400 hover:text-red-500 mt-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zones Manager */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-900 uppercase">Seating Zones & Pricing</label>
                <button type="button" onClick={addZone} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Zone
                </button>
              </div>

              {eventForm.zones.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                  No zones added yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {eventForm.zones.map((zone, index) => (
                    <div key={zone.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-4 relative group">
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Zone Name</label>
                        <input
                          type="text"
                          placeholder="e.g. VIP"
                          value={zone.name}
                          onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Capacity</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={zone.capacity}
                          onChange={(e) => updateZone(zone.id, 'capacity', e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Adult Price</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            value={zone.adultPrice}
                            onChange={(e) => updateZone(zone.id, 'adultPrice', e.target.value)}
                            required
                            className="w-full pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Child Price</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            value={zone.childrenPrice}
                            onChange={(e) => updateZone(zone.id, 'childrenPrice', e.target.value)}
                            required
                            className="w-full pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeZone(zone.id)} className="absolute -top-2 -right-2 bg-white shadow-sm p-1 rounded-full text-slate-400 hover:text-red-500 border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6">
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl font-black text-lg shadow-xl shadow-fuchsia-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Event
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default SmartScheduler;
