import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Row configuration with pricing categories
// A–D: Silver, E–K: Gold, L–M: VIP
const ROW_DEFS = [
  { id: 'A', type: 'silver' },
  { id: 'B', type: 'silver' },
  { id: 'C', type: 'silver' },
  { id: 'D', type: 'silver' },
  { id: 'E', type: 'gold' },
  { id: 'F', type: 'gold' },
  { id: 'G', type: 'gold' },
  { id: 'H', type: 'gold' },
  { id: 'I', type: 'gold' },
  { id: 'J', type: 'gold' },
  { id: 'K', type: 'gold' },
  { id: 'L', type: 'vip' },
  { id: 'M', type: 'vip' },
];

const SeatSelection = ({ selectedShow, onContinue, initialSelectedSeats = [] }) => {
  const [selectedSeats, setSelectedSeats] = useState(initialSelectedSeats);
  const [blockedSeats, setBlockedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1); // 1 = 100%

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 1.6;
  const ZOOM_STEP = 0.15;

  // Fetch blocked seats for this show
  useEffect(() => {
    const fetchBlockedSeats = async () => {
      if (!selectedShow?.showId) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `https://show-time-backend-production.up.railway.app/api/bookings/show/${selectedShow.showId}/blocked-seats`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        if (response.ok) {
          const seats = await response.json();
          setBlockedSeats(seats || []);
        }
      } catch (error) {
        console.error('Error fetching blocked seats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedSeats();
  }, [selectedShow?.showId]);

  // Generate a simple seat map without external mock data.
  const seats = useMemo(() => {
    const all = [];
    ROW_DEFS.forEach(row => {
      const seatCount = row.type === 'vip' ? 12 : 14;
      for (let i = 1; i <= seatCount; i++) {
        const seatId = `${row.id}${i}`;
        all.push({
          id: seatId,
          row: row.id,
          number: i,
          type: row.type,
          taken: blockedSeats.includes(seatId)
        });
      }
    });
    return all;
  }, [blockedSeats]);

  const toggleSeat = (seatId, isTaken) => {
    if (isTaken) return;

    setSelectedSeats(prev => {
      const isSelecting = !prev.includes(seatId);

      if (isSelecting && prev.length >= 6) {
        toast.error("Only 6 bookings allowed at a time", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        return prev;
      }

      return isSelecting
        ? [...prev, seatId]
        : prev.filter(id => id !== seatId);
    });
  };

  const getSeatsByRow = (rowId) => {
    return seats.filter(seat => seat.row === rowId);
  };
  // Owner-configured prices: Silver, Gold, and VIP
  const silverPrice = Number(
    selectedShow?.silverPrice ?? selectedShow?.price ?? 0
  );
  const goldPrice = Number(
    selectedShow?.goldPrice ?? selectedShow?.price ?? silverPrice
  );
  const vipPrice = Number(
    selectedShow?.vipPrice ?? selectedShow?.price ?? goldPrice
  );

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seatId) => {
      const seat = seats.find((s) => s.id === seatId);
      if (!seat) return sum;
      if (seat.type === 'vip') {
        return sum + vipPrice;
      } else if (seat.type === 'gold') {
        return sum + goldPrice;
      } else {
        // silver
        return sum + silverPrice;
      }
    }, 0);
  }, [selectedSeats, seats, silverPrice, goldPrice, vipPrice]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading seat availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <ToastContainer />
      {/* Zoom controls */}
      <div className="flex justify-end items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Seat map: fixed logical layout, scrollable with zoom */}
      <div
        className="w-full overflow-auto"
        style={{ maxHeight: 'calc(100vh - 320px)' }}
      >
        <div className="min-w-[900px] max-w-[1000px] mx-auto">
          <div
            className="inline-block origin-top-left space-y-6"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Screen */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="text-center text-slate-500 text-sm font-medium uppercase tracking-wide">
                <div className="relative mx-auto w-3/4 mb-6 perspective-[1000px]">

                  {/* Screen */}
                  <div
                    className="
              h-4
              bg-gradient-to-b from-blue-50 via-blue-100 to-blue-200
              rounded-[100%_100%_40%_40%]
              shadow-[0_20px_50px_rgba(147,197,253,0.45)]
              border-t border-blue-100/60
              opacity-90
            "
                    style={{
                      transform: 'rotateX(-15deg) scale(1)',
                      boxShadow: '0 25px 30px -5px rgba(147, 197, 253, 0.45)'
                    }}
                  />

                  {/* Light Reflection */}
                  <div
                    className="
              absolute top-2 left-1/2 -translate-x-1/2
              w-[80%] h-16
              bg-gradient-to-b from-blue-200/35 to-slate-900/0
              blur-2xl
              pointer-events-none
            "
                  />


                  {/* Light Reflection */}
                  <div
                    className="
                absolute top-2 left-1/2 -translate-x-1/2
                w-[80%] h-16
                bg-gradient-to-b from-[#FFFFF0]/30 to-transparent
                blur-2xl
                pointer-events-none
              "
                  />

                  {/* Label */}
                  <div className="text-center text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-8 opacity-70">
                    Screen
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Seat Legend */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm">
              {/* Available */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-600 text-xs font-medium">
                  A1
                </div>
                <span className="text-slate-600">Available</span>
              </div>
              {/* Selected */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-500 border border-blue-600 rounded flex items-center justify-center text-white text-xs font-medium">
                  A2
                </div>
                <span className="text-slate-600">Selected</span>
              </div>
              {/* Taken */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-600 border border-red-500 rounded flex items-center justify-center text-slate-200 text-xs font-medium relative">
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-300 text-lg leading-none">✕</span>
                  </span>
                </div>
                <span className="text-slate-600">Taken</span>
              </div>
              {/* Silver */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 border border-blue-400 rounded flex items-center justify-center text-slate-700 text-xs font-medium">
                  D5
                </div>
                <span className="text-slate-600">Silver (₹{silverPrice})</span>
              </div>
              {/* Gold */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 border border-yellow-400 rounded flex items-center justify-center text-yellow-800 text-xs font-medium">
                  H5
                </div>
                <span className="text-slate-600">Gold (₹{goldPrice})</span>
              </div>
              {/* VIP */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 border border-red-400 rounded flex items-center justify-center text-red-700 text-xs font-medium">
                  L1
                </div>
                <span className="text-slate-600">VIP (₹{vipPrice})</span>
              </div>
            </div>

            {/* Seat Map */}
            <div className="space-y-2 max-w-6xl mx-auto">
              {ROW_DEFS.map((row, rowIndex) => {
                const rowSeats = getSeatsByRow(row.id);
                const isVIP = row.type === 'vip';
                const isGold = row.type === 'gold';

                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: rowIndex * 0.03 }}
                    className="flex items-center gap-3"
                  >
                    {/* Row Label */}
                    <div
                      className={`w-10 text-center font-semibold text-sm ${isVIP
                        ? 'text-amber-600'
                        : isGold
                          ? 'text-yellow-600'
                          : 'text-slate-600'
                        }`}
                    >
                      {row.id}
                    </div>

                    {/* Seats Grid */}
                    <div className="flex-1 flex items-center gap-1.5 justify-center flex-wrap">
                      {rowSeats.map((seat, index) => {
                        const isSelected = selectedSeats.includes(seat.id);
                        const isTaken = seat.taken;

                        // Create aisle gap after 7th seat (middle aisle)
                        if (index === 7) {
                          return (
                            <div key={`aisle-${row.id}`} className="w-6" />
                          );
                        }

                        const isVipSeat = seat.type === 'vip';
                        const isGoldSeat = seat.type === 'gold';
                        const isSilverSeat = seat.type === 'silver';

                        return (
                          <button
                            key={seat.id}
                            onClick={() => toggleSeat(seat.id, isTaken)}
                            disabled={isTaken}
                            className={`
                        w-10 h-10
                        text-xs font-medium
                        transition-all duration-200
                        rounded
                        border-2
                        flex items-center justify-center
                        ${isTaken
                                ? 'bg-slate-600 border-red-500 text-slate-200 cursor-not-allowed relative'
                                : isSelected
                                  ? 'bg-blue-500 border-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-110 ring-2 ring-blue-400 ring-offset-2'
                                  : isVipSeat
                                    ? 'bg-slate-200 border-red-500 text-red-700 hover:bg-slate-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(248,113,113,0.55)] hover:border-red-600 transition-all duration-300'
                                    : isGoldSeat
                                      ? 'bg-slate-200 border-yellow-400 text-yellow-800 hover:bg-slate-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(250,204,21,0.55)] hover:border-yellow-500 transition-all duration-300'
                                      : isSilverSeat
                                        ? 'bg-slate-200 border-blue-400 text-slate-700 hover:bg-slate-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:border-blue-500 transition-all duration-300'
                                        : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300 hover:border-blue-400 hover:scale-110 hover:shadow-[0_0_20px_rgba(96,165,250,0.6)] transition-all duration-300'
                              }
                      `}
                            title={`Seat ${seat.id}`}
                          >
                            {isTaken ? (
                              <>
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-red-200 text-lg font-bold leading-none">✕</span>
                                </span>
                                <span className="opacity-0">{seat.number}</span>
                              </>
                            ) : (
                              seat.number
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Category Label */}
            <div className="text-center pt-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
                Rows A–D: Silver • Rows E–K: Gold • Rows L–M: VIP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      {selectedSeats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 p-6 shadow-lg z-50"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-8">
              {/* Selected Seats Info */}
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Selections</div>
                <div className="text-slate-900 text-2xl font-bold">
                  {selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'} • ₹{totalPrice}
                </div>
                <div className="text-slate-600 text-sm mt-1 font-medium">
                  {selectedSeats.sort().join(', ')}
                </div>
              </div>

              {/* Show Details */}
              <div className="hidden md:block h-12 w-px bg-slate-300" />

              <div className="hidden md:block">
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Show Details</div>
                <div className="text-slate-900 font-bold">
                  {selectedShow.theatreName}
                </div>
                <div className="text-slate-600 text-sm">
                  {selectedShow.date?.day} {selectedShow.date?.date} • {selectedShow.time}
                </div>
              </div>
            </div>

            <button
              onClick={() => onContinue(selectedSeats, totalPrice)}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors shadow-md"
            >
              Continue to Payment
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SeatSelection;

