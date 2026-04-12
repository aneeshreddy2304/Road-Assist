import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Crosshair,
  MapPin,
  Navigation,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
  Wrench,
  X,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  createRequest,
  getMechanicParts,
  getMyVehicles,
  getNearbyMechanics,
  searchParts,
} from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RICHMOND_CENTER = [37.5407, -77.4360];

const ownerIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #111827;
      border: 4px solid #ffffff;
      box-shadow: 0 10px 20px rgba(17,24,39,0.28);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const mechanicIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #16a34a;
      border: 4px solid #ffffff;
      box-shadow: 0 10px 20px rgba(22,163,74,0.28);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const busyMechanicIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #f97316;
      border: 4px solid #ffffff;
      box-shadow: 0 10px 20px rgba(249,115,22,0.28);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const KM_TO_MILES = 0.621371;

function toMiles(km) {
  const numericKm = Number(km);
  if (!Number.isFinite(numericKm)) return "";
  return `${(numericKm * KM_TO_MILES).toFixed(1)} mi`;
}

function MapViewport({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
}

export default function Search() {
  const navigate = useNavigate();
  const pageLocation = useLocation();
  const [tab, setTab] = useState("mechanics");
  const [location, setLocation] = useState({ lat: RICHMOND_CENTER[0], lng: RICHMOND_CENTER[1] });
  const [radius, setRadius] = useState(15);
  const [mechanics, setMechanics] = useState([]);
  const [parts, setParts] = useState([]);
  const [partQuery, setPartQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [inventoryMechanic, setInventoryMechanic] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("This browser does not support live location.");
      return;
    }

    setGeoLoading(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      (error) => {
        let message = "Could not fetch your current location.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Location access is blocked in your browser. Allow location for this site and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your device could not determine a location right now.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Try again in a moment.";
        }

        setGeoError(message);
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    requestCurrentLocation();
  }, []);

  useEffect(() => {
    const selectedId = pageLocation.state?.selectedMechanicId;
    if (!selectedId || mechanics.length === 0) return;
    const matched = mechanics.find((item) => item.mechanic_id === selectedId);
    if (matched) setSelected(matched);
  }, [pageLocation.state, mechanics]);

  useEffect(() => {
    fetchMechanics();
  }, [location, radius]);

  const mapCenter = useMemo(() => {
    if (selected) {
      return [(location.lat + selected.lat) / 2, (location.lng + selected.lng) / 2];
    }
    return [location.lat, location.lng];
  }, [location, selected]);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const res = await getNearbyMechanics({ lat: location.lat, lng: location.lng, radius_km: radius });
      setMechanics(res.data);
      if (res.data.length > 0 && !selected) {
        setSelected(res.data[0]);
      }
    } catch (error) {
      console.error(error);
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openRoute = (mechanic) => {
    const url = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${mechanic.lat},${mechanic.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const selectedDetail = selected ?? mechanics[0] ?? null;

  return (
    <div className="relative h-[calc(100vh-56px)] overflow-hidden bg-[#0b1320]">
      <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        <MapViewport center={mapCenter} zoom={selected ? 11 : 12} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        <Marker position={[location.lat, location.lng]} icon={ownerIcon}>
          <Popup>Your location</Popup>
        </Marker>

        <Circle
          center={[location.lat, location.lng]}
          radius={radius * 1000}
          pathOptions={{ color: "#111827", fillColor: "#111827", fillOpacity: 0.05, weight: 1.5 }}
        />

        {mechanics.map((mechanic) => (
          <Marker
            key={mechanic.mechanic_id}
            position={[mechanic.lat, mechanic.lng]}
            icon={mechanic.is_available ? mechanicIcon : busyMechanicIcon}
            eventHandlers={{ click: () => setSelected(mechanic) }}
          >
            <Popup>
              <strong>{mechanic.name}</strong>
              <br />
              {mechanic.specialization || "General repair"}
              <br />
              {toMiles(mechanic.distance_km)} away
            </Popup>
          </Marker>
        ))}

        {selected ? (
          <Polyline
            positions={[
              [location.lat, location.lng],
              [selected.lat, selected.lng],
            ]}
            pathOptions={{ color: "#111827", weight: 4, opacity: 0.65 }}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08111d]/90 via-transparent to-[#08111d]/30" />

      <div className="absolute inset-x-0 top-0 z-[500] p-4 lg:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full max-w-xl rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-2xl backdrop-blur md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">RoadAssist Live</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">Get roadside help fast</h1>
              </div>
              <div className="rounded-2xl bg-[#111827] px-3 py-2 text-right text-white shadow-lg">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Service radius</p>
                <p className="text-lg font-semibold">{toMiles(radius)}</p>
              </div>
            </div>

            <div className="mt-4 flex rounded-2xl bg-gray-100 p-1">
              {[
                { id: "mechanics", label: "Find mechanics", icon: <Wrench size={15} /> },
                { id: "parts", label: "Find parts", icon: <SearchIcon size={15} /> },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    tab === id ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr,1fr]">
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin size={14} className="text-gray-400" />
                  Pickup location
                </div>
                <p className="mt-1 text-base font-medium text-gray-900">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Default demo center is Richmond, VA. Tap current location anytime.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={requestCurrentLocation}
                  disabled={geoLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <Crosshair size={15} />
                  {geoLoading ? "Locating..." : "Current"}
                </button>
                {selectedDetail ? (
                  <button
                    onClick={() => openRoute(selectedDetail)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-3 py-3 text-sm font-medium text-white transition hover:bg-black"
                  >
                    <Navigation size={15} />
                    Route
                  </button>
                ) : null}
              </div>
            </div>

            {tab === "parts" ? (
              <div className="mt-3 flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3">
                  <SearchIcon size={16} className="text-gray-400" />
                  <input
                    value={partQuery}
                    onChange={(e) => setPartQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchParts()}
                    placeholder="Search brake pads, battery, spark plug..."
                    className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
                <button
                  onClick={fetchParts}
                  className="rounded-2xl bg-[#16a34a] px-5 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  Search
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              {geoError ? (
                <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {geoError}
                </p>
              ) : null}
              <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={13} />
                  Search radius
                </span>
                <span>{toMiles(radius)}</span>
              </div>
              <input
                type="range"
                min="3"
                max="40"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-black"
              />
            </div>
          </div>

          {selectedDetail ? (
            <div className="hidden w-full max-w-sm lg:block">
              <SelectedMechanicPanel
                mechanic={selectedDetail}
                userLocation={location}
                onOpenRoute={() => openRoute(selectedDetail)}
                onOpenInventory={() => setInventoryMechanic(selectedDetail)}
                onRequest={() => {
                  setSelected(selectedDetail);
                  setShowRequest(true);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[500] p-4 lg:hidden">
        {selectedDetail ? (
          <SelectedMechanicPanel
            mechanic={selectedDetail}
            userLocation={location}
            compact
            onOpenRoute={() => openRoute(selectedDetail)}
            onOpenInventory={() => setInventoryMechanic(selectedDetail)}
            onRequest={() => {
              setSelected(selectedDetail);
              setShowRequest(true);
            }}
          />
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 z-[450] w-full max-w-xl p-4 lg:bottom-6 lg:left-6 lg:w-[28rem]">
        <Card className="pointer-events-auto rounded-[28px] border border-white/80 bg-white/95 p-3 shadow-2xl backdrop-blur md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                {tab === "mechanics" ? "Nearby mechanics" : "Parts nearby"}
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-950">
                {tab === "mechanics"
                  ? `${mechanics.length} mechanic${mechanics.length === 1 ? "" : "s"} in range`
                  : `${parts.length} part match${parts.length === 1 ? "" : "es"}`}
              </p>
            </div>
            {loading ? <Spinner /> : null}
          </div>

          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {!loading && tab === "mechanics" && mechanics.length === 0 ? (
              <EmptyState
                icon="🗺️"
                title="No mechanics nearby yet"
                subtitle="Move the demo mechanics to Richmond in Supabase, or widen the radius to test the search flow."
              />
            ) : null}

            {tab === "mechanics" &&
              mechanics.map((mechanic) => (
                <MechanicCard
                  key={mechanic.mechanic_id}
                  mechanic={mechanic}
                  selected={selected?.mechanic_id === mechanic.mechanic_id}
                  onSelect={() => setSelected(mechanic)}
                  onViewInventory={() => setInventoryMechanic(mechanic)}
                  onRequest={() => {
                    setSelected(mechanic);
                    setShowRequest(true);
                  }}
                  userLocation={location}
                />
              ))}

            {!loading && tab === "parts" && partQuery && parts.length === 0 ? (
              <EmptyState icon="📦" title="No matching parts nearby" subtitle="Try a broader radius or a simpler part name." />
            ) : null}

            {tab === "parts" &&
              parts.map((part, index) => (
                <PartCard key={`${part.mechanic_id}-${part.part_name}-${index}`} part={part} />
              ))}
          </div>
        </Card>
      </div>

      {showRequest && selected ? (
        <RequestModal mechanic={selected} userLocation={location} onClose={() => setShowRequest(false)} />
      ) : null}

      {inventoryMechanic ? (
        <MechanicInventoryModal mechanic={inventoryMechanic} onClose={() => setInventoryMechanic(null)} />
      ) : null}
    </div>
  );
}

function SelectedMechanicPanel({ mechanic, userLocation, onOpenRoute, onOpenInventory, onRequest, compact = false }) {
  return (
    <div className="pointer-events-auto rounded-[28px] border border-white/70 bg-white/96 p-4 shadow-2xl backdrop-blur md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                mechanic.is_available ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}
            >
              {mechanic.is_available ? "Available now" : "Busy"}
            </span>
            <span className="text-xs font-medium text-gray-500">{toMiles(mechanic.distance_km)} away</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-gray-950">{mechanic.name}</h2>
          <p className="mt-1 text-sm text-gray-600">{mechanic.specialization || "General repair"}</p>
          <p className="mt-2 text-xs text-gray-500">{mechanic.address || "Richmond service area"}</p>
        </div>

        <div className="rounded-2xl bg-gray-100 px-3 py-2 text-right">
          <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            {mechanic.rating}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">{mechanic.total_reviews || 0} reviews</p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Your location</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Mechanic location</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {mechanic.lat.toFixed(4)}, {mechanic.lng.toFixed(4)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={onOpenRoute}
          className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Route
        </button>
        <button
          onClick={onOpenInventory}
          className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Parts
        </button>
        <button
          onClick={onRequest}
          className="rounded-2xl bg-[#111827] px-3 py-3 text-sm font-medium text-white transition hover:bg-black"
        >
          Request
        </button>
      </div>
    </div>
  );
}

function MechanicCard({ mechanic, selected, onSelect, onViewInventory, onRequest, userLocation }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[22px] border p-4 text-left transition ${
        selected
          ? "border-gray-900 bg-gray-950 text-white shadow-lg"
          : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">{mechanic.name}</p>
          <p className={`mt-1 text-sm ${selected ? "text-white/75" : "text-gray-500"}`}>
            {mechanic.specialization || "General repair"}
          </p>
          <p className={`mt-2 flex items-center gap-1 text-xs ${selected ? "text-white/60" : "text-gray-400"}`}>
            <MapPin size={11} />
            {mechanic.address || "Richmond service area"}
          </p>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-sm font-semibold">
            <Star size={13} className="fill-yellow-400 text-yellow-400" />
            {mechanic.rating}
          </div>
          <p className={`mt-1 text-xs ${selected ? "text-white/70" : "text-gray-500"}`}>{toMiles(mechanic.distance_km)}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
              mechanic.is_available
                ? selected
                  ? "bg-white/15 text-white"
                  : "bg-green-100 text-green-700"
                : selected
                  ? "bg-white/15 text-white"
                  : "bg-orange-100 text-orange-700"
            }`}
          >
            {mechanic.is_available ? "Available" : "Busy"}
          </span>
        </div>
      </div>

      {selected ? (
        <>
          <div className="mt-4 rounded-2xl bg-white/10 px-3 py-3 text-xs text-white/75">
            Pickup: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/mechanics/${mechanic.mechanic_id}`, { state: { mechanic, userLocation } });
              }}
              className="rounded-2xl bg-white px-3 py-2 text-xs font-medium text-gray-900"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewInventory();
              }}
              className="rounded-2xl bg-white/15 px-3 py-2 text-xs font-medium text-white"
            >
              Parts
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequest();
              }}
              className="rounded-2xl bg-[#16a34a] px-3 py-2 text-xs font-medium text-white"
            >
              Request
            </button>
          </div>
        </>
      ) : null}
    </button>
  );
}

function PartCard({ part }) {
  return (
    <div className="rounded-[22px] border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-950">{part.part_name}</p>
          <p className="mt-1 text-sm text-gray-500">
            {part.mechanic_name} · {toMiles(part.distance_km)} away
          </p>
          <p className="mt-2 text-xs text-gray-400">{part.mechanic_address || "Richmond service area"}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-gray-950">${Number(part.price).toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs font-medium text-green-600">{part.quantity} in stock</p>
          <div className="mt-2 flex items-center justify-end gap-1 text-xs text-gray-500">
            <Star size={11} className="fill-yellow-400 text-yellow-400" />
            {part.mechanic_rating}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestModal({ mechanic, userLocation, onClose }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [problemDesc, setProblemDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyVehicles().then((response) => {
      setVehicles(response.data);
      if (response.data.length > 0) setVehicleId(response.data[0].id);
    });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        {success ? (
          <div className="py-4 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h3 className="text-xl font-semibold text-gray-950">Assistance request sent</h3>
            <p className="mt-2 text-sm text-gray-500">You can track the status from My Jobs.</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-2xl bg-[#111827] py-3 text-sm font-medium text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Request roadside help</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-950">{mechanic.name}</h3>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.license_plate}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">What happened?</label>
                <textarea
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  required
                  rows={4}
                  placeholder="Flat tire, dead battery, engine won't start..."
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {error ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-[#111827] py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Confirm request"}
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
        const response = await getMechanicParts(mechanic.mechanic_id);
        setParts(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load inventory");
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [mechanic.mechanic_id]);

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Inventory</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-950">{mechanic.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {mechanic.specialization || "General repair"} · {toMiles(mechanic.distance_km)} away
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[30rem] overflow-y-auto px-6 py-5">
          {loading ? <Spinner /> : null}
          {!loading && error ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          {!loading && !error && parts.length === 0 ? (
            <EmptyState icon="📦" title="No parts listed" subtitle="This mechanic has not added inventory yet." />
          ) : null}
          {!loading && !error && parts.length > 0 ? (
            <div className="space-y-3">
              {parts.map((part) => (
                <div key={part.id} className="rounded-[22px] border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-950">{part.part_name}</p>
                      <p className="mt-1 text-xs text-gray-500">Part No: {part.part_number || "Not provided"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-950">${Number(part.price).toLocaleString("en-US")}</p>
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
