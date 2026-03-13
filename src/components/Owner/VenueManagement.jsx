import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, SlidersHorizontal, MapPin, Building2, Globe, Hash } from 'lucide-react';
import { AVAILABLE_AMENITIES } from '../../data/mockData';
import VenueCard from './VenueCard';
import { toast } from 'react-toastify';

const VenueManagement = ({ owner }) => {
  const [venues, setVenues] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteVenueId, setConfirmDeleteVenueId] = useState(null);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'theatre', 'event_ground'
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    pincode: '',
    country: 'India',
    capacity: '',
    amenities: [],
    type: 'theatre'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  // Load venues for this owner from backend
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
        setVenues(
          data.map((v) => ({
            ...v,
            // Backend stores amenities as JSON/text; normalize to array for UI.
            amenities: (() => {
              if (!v.amenities) return [];
              try {
                const parsed = JSON.parse(v.amenities);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })(),
          }))
        );
      } catch (err) {
        console.error('Error loading venues for owner:', err);
        setVenues([]);
      }
    };
    loadVenues();
  }, [owner]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!owner?.id) return;

    const pincode = String(formData.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      toast.error('Pincode must be exactly 6 digits');
      return;
    }

    const payload = {
      ownerId: owner.id,
      name: formData.name,
      // Map UI type to backend enum
      type: formData.type === 'event_ground' ? 'EVENT_GROUND' : 'THEATRE',
      location: formData.location,
      address: formData.address,
      pincode,
      country: formData.country,
      capacity: parseInt(formData.capacity, 10),
      amenities: JSON.stringify(formData.amenities || []),
    };

    try {
      const token = localStorage.getItem('token');
      const isEditing = Boolean(editingVenueId);
      const url = isEditing
        ? `https://show-time-backend-production.up.railway.app/api/venues/${editingVenueId}`
        : 'https://show-time-backend-production.up.railway.app/api/venues';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const errHeader = res.headers.get('X-Error');
        throw new Error(errHeader || errText || 'Failed to create venue');
      }
      const saved = await res.json();
      if (isEditing) {
        setVenues((prev) =>
          prev.map((v) =>
            v.id === editingVenueId ? { ...saved, amenities: formData.amenities } : v
          )
        );
        toast.success('Venue updated');
      } else {
        setVenues((prev) => [
          ...prev,
          {
            ...saved,
            amenities: formData.amenities,
          },
        ]);
        toast.success('Venue created');
      }
      setFormData({
        name: '',
        location: '',
        address: '',
        pincode: '',
        country: 'India',
        capacity: '',
        amenities: [],
        type: 'theatre',
      });
      setEditingVenueId(null);
      setShowAddModal(false);
    } catch (err) {
      console.error('Error creating venue:', err);
      toast.error(err?.message || 'Failed to create venue. Please try again.');
    }
  };

  const handleDelete = (venueId) => {
    setConfirmDeleteVenueId(venueId);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteVenueId) return;
    setDeletingVenue(true);
    try {
      const res = await fetch(
        `https://show-time-backend-production.up.railway.app/api/venues/${confirmDeleteVenueId}${owner?.id ? `?ownerId=${owner.id}` : ''}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error(text || 'Failed to delete venue');
        return;
      }

      setVenues((prev) => prev.filter((v) => v.id !== confirmDeleteVenueId));
      toast.success('Venue deleted');
      setConfirmDeleteVenueId(null);
    } catch (e) {
      console.error('Error deleting venue:', e);
      toast.error('Failed to delete venue. Please try again.');
    } finally {
      setDeletingVenue(false);
    }
  };

  const handleEdit = (venue) => {
    setEditingVenueId(venue.id);
    setFormData({
      name: venue.name,
      location: venue.location,
      address: venue.address,
      pincode: venue.pincode,
      country: venue.country,
      capacity: venue.capacity.toString(),
      amenities: venue.amenities || [],
      // Map backend enum to UI value
      type:
        (venue.type || '').toString().toUpperCase() === 'EVENT_GROUND'
          ? 'event_ground'
          : 'theatre',
    });
    setShowAddModal(true);
  };

  // Filter venues
  const filteredVenues = venues.filter((venue) => {
    // Filter by type (backend uses THEATRE / EVENT_GROUND)
    if (filterType !== 'all') {
      const backendType = (venue.type || '').toString().toUpperCase();
      if (filterType === 'theatre' && backendType !== 'THEATRE') return false;
      if (filterType === 'event_ground' && backendType !== 'EVENT_GROUND') return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        venue.name.toLowerCase().includes(query) ||
        venue.location.toLowerCase().includes(query) ||
        venue.address.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Venue Management</h1>
          <p className="text-slate-500 font-medium mt-1">Configure your theatres and event spaces.</p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              location: '',
              address: '',
              pincode: '',
              country: 'India',
              capacity: '',
              amenities: [],
              type: 'theatre'
            });
            setEditingVenueId(null);
            setShowAddModal(true);
          }}
          className="group px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-3 active:scale-95"
        >
          <div className="p-1 rounded-full bg-white/20">
            <Plus className="w-4 h-4 text-white" />
          </div>
          Add New Venue
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative group flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium shadow-sm hover:border-slate-300"
          />
        </div>

        {/* Filter Buttons */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex md:w-auto w-full">
          {[
            { value: 'all', label: 'All' },
            { value: 'theatre', label: 'Theatres' },
            { value: 'event_ground', label: 'Events' }
          ].map(type => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === type.value
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Venue Grid */}
      {filteredVenues.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No venues found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Get started by adding your first theatre or event ground.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative my-8"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-900">
                  {editingVenueId ? 'Edit Venue' : 'New Venue'}
                </h2>
                <p className="text-sm text-slate-500 font-medium">Enter venue details below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Cinema One"
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="e.g. Indiranagar"
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Full address..."
                    required
                    rows="2"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData((prev) => ({ ...prev, pincode: digitsOnly }));
                      }}
                      required
                      maxLength={6}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Capacity</label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      required
                      min="1"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Venue Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleInputChange({ target: { name: 'type', value: 'theatre' } })}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${formData.type === 'theatre'
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                      <Building2 className={`w-5 h-5 ${formData.type === 'theatre' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className={`text-sm font-bold ${formData.type === 'theatre' ? 'text-indigo-900' : 'text-slate-600'}`}>Theatre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange({ target: { name: 'type', value: 'event_ground' } })}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${formData.type === 'event_ground'
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                      <MapPin className={`w-5 h-5 ${formData.type === 'event_ground' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className={`text-sm font-bold ${formData.type === 'event_ground' ? 'text-indigo-900' : 'text-slate-600'}`}>Event Ground</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amenities</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_AMENITIES.map((amenity) => (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${formData.amenities.includes(amenity)
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                      >
                        {amenity}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-slate-200"
                  >
                    {editingVenueId ? 'Update Venue' : 'Create Venue'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDeleteVenueId != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDeleteVenueId(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Delete this venue?</h3>
              <p className="text-slate-500 font-medium mb-6">
                This action cannot be undone. All associated data will be removed.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteVenueId(null)}
                  disabled={deletingVenue}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deletingVenue}
                  className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-lg shadow-red-500/30"
                >
                  {deletingVenue ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VenueManagement;

