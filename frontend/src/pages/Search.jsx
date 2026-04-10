import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import { getNearbyMechanics, searchParts, getMyVehicles, createRequest, getMechanicParts } from "../api/endpoints";
import { Card, Spinner, EmptyState } from "../components/UI";
import { MapPin, Search as SearchIcon, Star, Wrench, Navigation, X, Crosshair } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const HYD_CENTER = [17.385, 78.4867];

export default function Search() {
  const navigate = useNavigate();
  const pageLocation = useLocation();
  const [tab, setTab] = useState("mechanics"); // "mechanics" | "parts"
  const [location, setLocation] = useState({ lat: HYD_CENTER[0], lng: HYD_CENTER[1] });
  const [radius, setRadius] = useState(10);
  const [mechanics, setMechanics] = useState([]);
  const [parts, setParts]         = useState([]);
  const [partQuery, setPartQuery] = useState("");
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null); // selected mechanic
  const [showRequest, setShowRequest] = useState(false);
  const [inventoryMechanic, setInventoryMechanic] = useState(null);

  // Get user's real location on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // fallback to Hyderabad centre
    );
  }, []);

  useEffect(() => {
    const selectedId = pageLocation.state?.selectedMechanicId;
    if (!selectedId || mechanics.length === 0) return;
    const matched = mechanics.find((item) => item.mechanic_id === selectedId);
    if (matched) setSelected(matched);
  }, [pageLocation.state, mechanics]);

  // Auto-search mechanics when location/radius changes
  useEffect(() => {
    fetchMechanics();
  }, [location, radius]);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const res = await getNearbyMechanics({ lat: location.lat, lng: location.lng, radius_km: radius });
      setMechanics(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchParts = async () => {
    if (!partQuery.trim()) return;
    setLoading(true);
    try {
      const res = await searchParts({ name: partQuery, lat: location.lat, lng: location.lng, radius_km: radius });
      setParts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refreshLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  const openRoute = (mechanic) => {
    const url = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${mechanic.lat},${mechanic.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Find Help Near You</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {[
          { id: "mechanics", label: "Nearby Mechanics", icon: <Wrench size={15} /> },
          { id: "parts",     label: "Search Parts",     icon: <SearchIcon size={15} /> },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-400"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: controls + results list */}
        <div className="space-y-3">
          {/* Controls */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Navigation size={15} className="text-brand-500" />
              <span>Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={refreshLocation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-brand-300 hover:text-brand-700"
              >
                <Crosshair size={14} />
                Use Current Location
              </button>
              {selected ? (
                <button
                  onClick={() => openRoute(selected)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
                >
                  <Navigation size={14} />
                  Open Route
                </button>
              ) : null}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Radius: {radius} km</label>
              <input
                type="range" min="1" max="25" value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>

            {tab === "parts" && (
              <div className="flex gap-2">
                <input
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchParts()}
                  placeholder="e.g. brake pads, spark plug..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={fetchParts}
                  className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-brand-700"
                >
                  <SearchIcon size={15} />
                </button>
              </div>
            )}
          </Card>

          {/* Results */}
          {loading ? <Spinner /> : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {tab === "mechanics" && mechanics.map((m) => (
                <MechanicCard
                  key={m.mechanic_id}
                  mechanic={m}
                  userLocation={location}
                  selected={selected?.mechanic_id === m.mechanic_id}
                  onSelect={() => setSelected(m)}
                  onViewInventory={() => setInventoryMechanic(m)}
                  onRequest={() => { setSelected(m); setShowRequest(true); }}
                />
              ))}
              {tab === "mechanics" && mechanics.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No mechanics found in this radius</p>
              )}
              {tab === "mechanics" && selected ? (
                <Card className="border-brand-200 bg-brand-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Exact mechanic location: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Your current shared location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                </Card>
              ) : null}

              {tab === "parts" && parts.map((p, i) => (
                <PartCard key={i} part={p} />
              ))}
              {tab === "parts" && parts.length === 0 && partQuery && (
                <p className="text-center text-sm text-gray-400 py-8">No parts found nearby</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div className="h-[540px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <MapContainer center={[location.lat, location.lng]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {/* User location */}
            <Marker position={[location.lat, location.lng]}>
              <Popup>Your location</Popup>
            </Marker>
            {/* Search radius circle */}
            <Circle
              center={[location.lat, location.lng]}
              radius={radius * 1000}
              pathOptions={{ color: "#ea580c", fillOpacity: 0.05, weight: 1.5 }}
            />
            {/* Mechanic markers */}
            {tab === "mechanics" && mechanics.map((m) => (
              <Marker
                key={m.mechanic_id}
                position={[m.lat, m.lng]}
              >
                <Popup>
                  <strong>{m.name}</strong><br />
                  ⭐ {m.rating} · {m.distance_km} km away<br />
                  {m.specialization}
                </Popup>
              </Marker>
            ))}
            {tab === "mechanics" && selected ? (
              <Polyline
                positions={[
                  [location.lat, location.lng],
                  [selected.lat, selected.lng],
                ]}
                pathOptions={{ color: "#ea580c", weight: 4 }}
              />
            ) : null}
          </MapContainer>
        </div>
      </div>

      {/* Request modal */}
      {showRequest && selected && (
        <RequestModal
          mechanic={selected}
          userLocation={location}
          onClose={() => setShowRequest(false)}
        />
      )}

      {inventoryMechanic && (
        <MechanicInventoryModal
          mechanic={inventoryMechanic}
          onClose={() => setInventoryMechanic(null)}
        />
      )}
    </div>
  );
}

function MechanicCard({ mechanic: m, userLocation, selected, onSelect, onViewInventory, onRequest }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        selected ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:border-brand-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm text-gray-900">{m.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{m.specialization || "General repair"}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin size={11} />{m.address || "Hyderabad"}
          </p>
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className="flex items-center gap-1 justify-end">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-medium">{m.rating}</span>
          </div>
          <p className="text-xs text-gray-400">{m.distance_km} km</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            m.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {m.is_available ? "Available" : "Busy"}
          </span>
        </div>
      </div>
      {selected && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mechanics/${m.mechanic_id}`, {
                state: { mechanic: m, userLocation },
              });
            }}
            className="w-full border border-gray-200 bg-white text-gray-700 text-xs py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewInventory(); }}
            className="w-full border border-brand-200 bg-white text-brand-700 text-xs py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            View Parts
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRequest(); }}
            className="w-full bg-brand-600 text-white text-xs py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Request Assistance
          </button>
        </div>
      )}
    </div>
  );
}

function PartCard({ part: p }) {
  return (
    <div className="p-3 rounded-xl border border-gray-200 bg-white">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-sm text-gray-900">{p.part_name}</p>
          <p className="text-xs text-gray-500">{p.mechanic_name} · {p.distance_km} km</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.mechanic_address}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">₹{p.price}</p>
          <p className="text-xs text-green-600">{p.quantity} in stock</p>
          <div className="flex items-center gap-0.5 justify-end mt-0.5">
            <Star size={11} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs">{p.mechanic_rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestModal({ mechanic, userLocation, onClose }) {
  const [vehicles, setVehicles]       = useState([]);
  const [vehicleId, setVehicleId]     = useState("");
  const [problemDesc, setProblemDesc] = useState("");
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    getMyVehicles().then((r) => {
      setVehicles(r.data);
      if (r.data.length > 0) setVehicleId(r.data[0].id);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createRequest({
        vehicle_id: vehicleId,
        problem_desc: problemDesc,
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-semibold text-gray-900">Request Sent!</h3>
            <p className="text-sm text-gray-500 mt-1">
              Your request has been sent. Track it in My Jobs.
            </p>
            <button onClick={onClose} className="mt-4 w-full bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-gray-900 mb-1">Request Assistance</h3>
            <p className="text-sm text-gray-500 mb-4">From: <strong>{mechanic.name}</strong></p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Vehicle</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model} — {v.license_plate}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
                <textarea
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  required
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Describe your issue..."
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                  {loading ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function MechanicInventoryModal({ mechanic, onClose }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInventory() {
      try {
        const res = await getMechanicParts(mechanic.mechanic_id);
        setParts(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load inventory");
      } finally {
        setLoading(false);
      }
    }
    loadInventory();
  }, [mechanic.mechanic_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{mechanic.name}</h3>
            <p className="text-sm text-gray-500">
              {mechanic.specialization || "General repair"} • {mechanic.distance_km} km away
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto px-6 py-4">
          {loading ? <Spinner /> : null}
          {!loading && error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}
          {!loading && !error && parts.length === 0 ? (
            <EmptyState icon="📦" title="No parts listed" subtitle="This mechanic has not added inventory yet." />
          ) : null}
          {!loading && !error && parts.length > 0 ? (
            <div className="space-y-3">
              {parts.map((part) => (
                <div key={part.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{part.part_name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Part No: {part.part_number || "Not provided"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{Number(part.price).toLocaleString("en-IN")}</p>
                      <p className={`mt-1 text-xs ${part.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                        {part.quantity > 0 ? `${part.quantity} in stock` : "Out of stock"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
