import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { Minus, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const ZoneSelection = ({ event, selectedDate, onContinue }) => {
  const [cart, setCart] = useState({});
  const [zoneAvailability, setZoneAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch zone availability
  useEffect(() => {
    const fetchZoneAvailability = async () => {
      if (!event?.id || !selectedDate?.id) {
        setLoading(false);
        return;
      }

      try {
        const url = `https://show-time-backend-production.up.railway.app/api/bookings/event/${event.id}/zone-availability?eventDateId=${selectedDate.id}`;
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const availability = await response.json();
          setZoneAvailability(availability || {});
        }
      } catch (error) {
        console.error('Error fetching zone availability:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchZoneAvailability();
  }, [event?.id, selectedDate?.id]);

  const updateQuantity = (zoneName, categoryType, delta) => {
    // Check zone availability before adding
    if (delta > 0) {
      const availability = zoneAvailability[zoneName];

      // Check if zone is completely full
      if (availability && availability.available === 0) {
        toast.error(`${zoneName} is completely sold out! No more passes available.`);
        return;
      }

      // Calculate current total passes for this zone (all categories combined)
      const currentZoneTotal = Object.values(cart[zoneName] || {}).reduce((sum, qty) => sum + qty, 0);

      // Check if adding this pass would exceed the zone's remaining capacity
      if (availability && currentZoneTotal + delta > availability.available) {
        toast.warn(
          `${zoneName} only has ${availability.available} passes remaining. You currently have ${currentZoneTotal} in cart.`
        );
        return;
      }
    }

    // IMPORTANT: keep this updater fully immutable.
    // In React StrictMode, state updaters can be invoked twice in dev.
    // If we mutate nested objects, a single click can look like +2.
    setCart((prev) => {
      const prevZone = prev[zoneName] || {};
      const prevQty = Number(prevZone[categoryType] || 0);
      const nextQty = Math.max(0, prevQty + delta);

      // Build next zone object immutably
      let nextZone = { ...prevZone };
      if (nextQty === 0) {
        delete nextZone[categoryType];
      } else {
        nextZone = { ...nextZone, [categoryType]: nextQty };
      }

      // Build next cart immutably
      const nextCart = { ...prev };
      if (Object.keys(nextZone).length === 0) {
        delete nextCart[zoneName];
      } else {
        nextCart[zoneName] = nextZone;
      }
      return nextCart;
    });
  };

  const getQuantity = (zoneName, categoryType) => {
    return cart[zoneName]?.[categoryType] || 0;
  };

  const calculateTotal = useMemo(() => {
    let totalPasses = 0;
    let totalPrice = 0;

    Object.entries(cart).forEach(([zoneName, categories]) => {
      const zone = event.zones.find(z => z.name === zoneName);
      if (zone) {
        Object.entries(categories).forEach(([categoryType, quantity]) => {
          const category = zone.categories.find(c => c.type === categoryType);
          if (category) {
            totalPasses += quantity;
            totalPrice += category.price * quantity;
          }
        });
      }
    });

    return { totalPasses, totalPrice };
  }, [cart, event.zones]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading zone availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stage Visual */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="mx-auto w-4/5 h-2 bg-gradient-to-r from-transparent via-emerald-500 to-transparent rounded-full mb-2" />
        <div className="text-center text-slate-600 text-sm uppercase tracking-widest">
          Stage
        </div>
      </motion.div>

      {/* Zone Cards */}
      <div className="space-y-4">
        {event.zones.map((zone, index) => {
          const availability = zoneAvailability[zone.name];
          const isZoneFull = availability && availability.available === 0;

          // Calculate total passes in cart for this zone
          const currentZoneInCart = Object.values(cart[zone.name] || {}).reduce((sum, qty) => sum + qty, 0);

          // Calculate remaining capacity
          // If no availability data yet, use zone capacity as fallback
          const totalAvailable = availability ? availability.available : (zone.capacity || 999);
          const remainingCapacity = totalAvailable - currentZoneInCart;

          return (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-2xl border p-6 shadow-sm ${
                isZoneFull ? 'opacity-70 border-red-300 bg-red-50' : 'border-slate-200 bg-white'
              }`}
            >
              {/* Zone Header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                    {zone.name}
                  </h3>
                  {isZoneFull && (
                    <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                      ZONE SOLD OUT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-slate-600 text-sm">
                    Starts ₹{Math.min(...zone.categories.map(c => c.price))}
                  </p>
                  {availability && (
                    <div className="flex items-center gap-3">
                      <p className={`text-sm font-semibold ${availability.available === 0
                          ? 'text-red-600'
                          : availability.available < 20
                            ? 'text-orange-600'
                            : 'text-green-600'
                        }`}>
                        {availability.available} available
                      </p>
                      {currentZoneInCart > 0 && (
                        <p className="text-xs text-emerald-700 font-medium">
                          ({currentZoneInCart} in cart)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Category Rows with Steppers */}
              <div className="space-y-3">
                {zone.categories.map((category) => {
                  const quantity = getQuantity(zone.name, category.type);

                  // Check if we can add more passes
                  const canAddMore = !isZoneFull && remainingCapacity > 0;

                  return (
                    <div
                      key={category.type}
                      className={`flex items-center justify-between p-3 rounded-lg ${isZoneFull ? 'bg-red-50/50 opacity-60' : 'bg-slate-50'
                        }`}
                    >
                      <div className="flex-1">
                        <div className="text-slate-900 font-semibold">{category.type}</div>
                        <div className="text-emerald-700 font-bold">₹{category.price}</div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(zone.name, category.type, -1)}
                          disabled={quantity === 0}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(zone.name, category.type, 1)}
                          disabled={!canAddMore}
                          className={`w-8 h-8 rounded-lg text-white transition-all flex items-center justify-center shadow-md ${canAddMore
                              ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                              : 'bg-slate-400 cursor-not-allowed'
                            }`}
                          title={!canAddMore ? (isZoneFull ? 'Zone is sold out' : 'Zone capacity reached with your current selection') : 'Add pass'}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Zone Full Warning */}
              {isZoneFull ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-600 border border-red-700 rounded-lg flex items-center gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
                  <p className="text-sm text-white font-bold">
                    ZONE SOLD OUT - This zone has no remaining capacity.
                  </p>
                </motion.div>
              ) : remainingCapacity === 0 && currentZoneInCart > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg flex items-center gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <p className="text-sm text-orange-800 font-medium">
                    You've reached the remaining capacity for this zone with your current selection.
                  </p>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Cart Summary Footer */}
      {calculateTotal.totalPasses > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-0 bg-white border-t-2 border-emerald-600 p-6 rounded-t-lg shadow-lg"
        >
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div>
              <div className="text-slate-600 text-sm mb-1">Selected Passes</div>
              <div className="text-slate-900 text-2xl font-bold">
                {calculateTotal.totalPasses} {calculateTotal.totalPasses === 1 ? 'Pass' : 'Passes'} • ₹{calculateTotal.totalPrice}
              </div>
            </div>
            <button
              onClick={() => onContinue(cart, calculateTotal.totalPrice)}
              className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold uppercase tracking-wider transition-all shadow-lg"
            >
              Proceed to Payment
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ZoneSelection;


