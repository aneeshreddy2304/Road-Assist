import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Crosshair,
  MapPin,
  Navigation,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
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
  suggestParts,
} from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";
import { formatCurrencyUSD, formatMilesFromKm } from "../lib/formatters";

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
      box-shadow: 0 10px 20px rgba(22,163,74,0.30);
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
      box-shadow: 0 10px 20px rgba(249,115,22,0.30);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

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
  const [suggestions, setSuggestions] = useState([]);
  const [partQuery, setPartQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [inventoryMechanic, setInventoryMechanic] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  const selectedDetail = selected ?? mechanics[0] ?? null;

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
          message = "Your browser could not determine your location. This is common on laptops without precise GPS, so you can keep using the Richmond demo center or allow location and try again.";
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

  useEffect(() => {
    if (tab !== "parts") return;
    const trimmed = partQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await suggestParts({
          q: trimmed,
          lat: location.lat,
          lng: location.lng,
          radius_km: radius,
        });
        setSuggestions(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [tab, partQuery, location, radius]);

  const mapCenter = useMemo(() => {
    if (selectedDetail) {
      return [(location.lat + selectedDetail.lat) / 2, (location.lng + selectedDetail.lng) / 2];
    }
    return [location.lat, location.lng];
  }, [location, selectedDetail]);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const res = await getNearbyMechanics({ lat: location.lat, lng: location.lng, radius_km: radius });
      setMechanics(res.data);
      setSelected((prev) => {
        if (!res.data.length) return null;
        if (!prev) return res.data[0];
        return res.data.find((item) => item.mechanic_id === prev.mechanic_id) || res.data[0];
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParts = async (queryOverride) => {
    const query = (queryOverride ?? partQuery).trim();
    if (!query) return;

    setLoading(true);
    try {
      const res = await searchParts({ name: query, lat: location.lat, lng: location.lng, radius_km: radius });
      setParts(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (suggestion) => {
    setPartQuery(suggestion.part_name);
    setSuggestions([]);
    await fetchParts(suggestion.part_name);
  };

  const openRoute = (mechanic) => {
    const url = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${mechanic.lat},${mechanic.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative h-[calc(100vh-56px)] overflow-hidden bg-[#0b1320]">
      <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        <MapViewport center={mapCenter} zoom={selectedDetail ? 11 : 12} />
        <ZoomControl position="bottomright" />
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
          pathOptions={{ color: "#111827", fillColor: "#111827", fillOpacity: 0.06, weight: 1.75 }}
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
              {formatMilesFromKm(mechanic.distance_km)} away
            </Popup>
          </Marker>
        ))}

        {selectedDetail ? (
          <Polyline
            positions={[
              [location.lat, location.lng],
              [selectedDetail.lat, selectedDetail.lng],
            ]}
            pathOptions={{ color: "#111827", weight: 4, opacity: 0.7 }}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_24%),linear-gradient(to_bottom,rgba(8,17,29,0.08),rgba(8,17,29,0.62))]" />

      <div className="absolute inset-x-0 top-0 z-[500] p-4 lg:p-6">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[30rem,minmax(0,1fr),30rem] lg:items-start">
          <div className="space-y-4">
            <Card className="rounded-[30px] border border-white/70 bg-white/92 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">RoadAssist Live</p>
                  <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight text-gray-950">
                    Get roadside help fast
                  </h1>
                </div>
                <div className="rounded-[24px] bg-[#0f172a] px-4 py-3 text-right text-white shadow-xl">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Service radius</p>
                  <p className="mt-1 text-2xl font-semibold">{formatMilesFromKm(radius)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-[24px] bg-gray-100 p-1">
                {[
                  { id: "mechanics", label: "Find mechanics", icon: <Wrench size={15} /> },
                  { id: "parts", label: "Find parts", icon: <SearchIcon size={15} /> },
                ].map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
                      tab === id ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),9.5rem,9.5rem]">
                <div className="rounded-[24px] border border-gray-200 bg-white px-4 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin size={14} className="text-gray-400" />
                    Pickup location
                  </div>
                  <p className="mt-2 text-base font-medium text-gray-950">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Default demo center is Richmond, VA. Use current location if your browser can resolve it.
                  </p>
                </div>

                <button
                  onClick={requestCurrentLocation}
                  disabled={geoLoading}
                  className="rounded-[24px] border border-gray-200 bg-white px-4 py-4 text-left text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Crosshair size={18} />
                  <p className="mt-6 text-xl font-semibold">{geoLoading ? "Locating..." : "Current"}</p>
                  <p className="mt-1 text-sm text-gray-500">Refresh my spot</p>
                </button>

                <button
                  onClick={() => selectedDetail && openRoute(selectedDetail)}
                  disabled={!selectedDetail}
                  className="rounded-[24px] bg-[#0f172a] px-4 py-4 text-left text-white transition hover:bg-black disabled:opacity-60"
                >
                  <Navigation size={18} />
                  <p className="mt-6 text-xl font-semibold">Route</p>
                  <p className="mt-1 text-sm text-white/65">Open directions</p>
                </button>
              </div>

              {tab === "parts" ? (
                <div className="relative mt-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <div className="flex items-center gap-2 rounded-[24px] border border-gray-200 bg-white px-4">
                        <SearchIcon size={16} className="text-gray-400" />
                        <input
                          value={partQuery}
                          onChange={(e) => setPartQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              fetchParts();
                            }
                          }}
                          placeholder="Search brake pads, battery, spark plug..."
                          className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                        />
                      </div>

                      {(partQuery.trim() || suggestionsLoading) && (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-20 overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-2xl">
                          {suggestionsLoading ? (
                            <div className="px-4 py-4 text-sm text-gray-500">Looking for nearby parts...</div>
                          ) : suggestions.length > 0 ? (
                            suggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.part_name}-${suggestion.part_number ?? "none"}`}
                                type="button"
                                onClick={() => applySuggestion(suggestion)}
                                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{suggestion.part_name}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {suggestion.mechanic_count} mechanic{suggestion.mechanic_count === 1 ? "" : "s"} nearby · {formatMilesFromKm(suggestion.closest_distance_km)}
                                  </p>
                                </div>
                                <ChevronRight size={16} className="text-gray-300" />
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-4 text-sm text-gray-500">
                              No close matches yet. Try a simpler term like `oxygen`, `brake`, or `battery`.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => fetchParts()}
                      className="rounded-[24px] bg-[#16a34a] px-6 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      Search
                    </button>
                  </div>
                </div>
              ) : null}

              {geoError ? (
                <p className="mt-4 rounded-[20px] bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                  {geoError}
                </p>
              ) : null}

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal size={13} />
                    Search radius
                  </span>
                  <span>{formatMilesFromKm(radius)}</span>
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
            </Card>

            <Card className="rounded-[30px] border border-white/80 bg-white/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {tab === "mechanics" ? "Nearby mechanics" : "Parts nearby"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-950">
                    {tab === "mechanics"
                      ? `${mechanics.length} mechanic${mechanics.length === 1 ? "" : "s"}`
                      : `${parts.length} part match${parts.length === 1 ? "" : "es"}`}
                  </p>
                </div>
                {loading ? <Spinner /> : null}
              </div>

              <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                {!loading && tab === "mechanics" && mechanics.length === 0 ? (
                  <EmptyState
                    icon="🗺️"
                    title="No mechanics nearby yet"
                    subtitle="Try a wider radius or keep using Richmond as the demo center while location services are unavailable."
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
                  <EmptyState
                    icon="📦"
                    title="No matching parts nearby"
                    subtitle="Keep typing to see smarter suggestions, or select one from the list above."
                  />
                ) : null}

                {tab === "parts" &&
                  parts.map((part, index) => (
                    <PartCard key={`${part.mechanic_id}-${part.part_name}-${index}`} part={part} />
                  ))}
              </div>
            </Card>
          </div>

          <div className="hidden lg:block" />

          <div className="space-y-4">
            {selectedDetail ? (
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
            ) : null}

            <Card className="rounded-[30px] border border-white/80 bg-white/92 p-4 shadow-2xl backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Map tips</p>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <Sparkles size={14} className="text-gray-700" />
                  </span>
                  <p>Green markers are available mechanics. Orange markers are busy right now.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <Navigation size={14} className="text-gray-700" />
                  </span>
                  <p>The black line shows the quickest visual route from your shared location to the selected mechanic.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <SearchIcon size={14} className="text-gray-700" />
                  </span>
                  <p>Parts search now suggests close matches as you type, even with partial words and small spelling mistakes.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {showRequest && selectedDetail ? (
        <RequestModal mechanic={selectedDetail} userLocation={location} onClose={() => setShowRequest(false)} />
      ) : null}

      {inventoryMechanic ? (
        <MechanicInventoryModal mechanic={inventoryMechanic} onClose={() => setInventoryMechanic(null)} />
      ) : null}
    </div>
  );
}

function SelectedMechanicPanel({ mechanic, userLocation, onOpenRoute, onOpenInventory, onRequest }) {
  return (
    <Card className="rounded-[30px] border border-white/80 bg-white/96 p-5 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                mechanic.is_available ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}
            >
              {mechanic.is_available ? "Available now" : "Busy"}
            </span>
            <span className="text-xs font-medium text-gray-500">{formatMilesFromKm(mechanic.distance_km)} away</span>
          </div>
          <h2 className="mt-3 text-[2rem] font-semibold leading-tight text-gray-950">{mechanic.name}</h2>
          <p className="mt-1 text-base text-gray-600">{mechanic.specialization || "General repair"}</p>
          <p className="mt-2 text-sm text-gray-500">{mechanic.address || "Richmond service area"}</p>
        </div>

        <div className="rounded-[24px] bg-gray-100 px-4 py-3 text-right">
          <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            {mechanic.rating}
          </div>
          <p className="mt-1 text-xs text-gray-500">{mechanic.total_reviews || 0} reviews</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-gray-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Your location</p>
          <p className="mt-2 text-base font-medium text-gray-900">
            {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </p>
        </div>
        <div className="rounded-[24px] bg-gray-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Mechanic location</p>
          <p className="mt-2 text-base font-medium text-gray-900">
            {mechanic.lat.toFixed(4)}, {mechanic.lng.toFixed(4)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={onOpenRoute}
          className="rounded-[20px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Route
        </button>
        <button
          onClick={onOpenInventory}
          className="rounded-[20px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Parts
        </button>
        <button
          onClick={onRequest}
          className="rounded-[20px] bg-[#0f172a] px-3 py-3 text-sm font-medium text-white transition hover:bg-black"
        >
          Request
        </button>
      </div>
    </Card>
  );
}

function MechanicCard({ mechanic, selected, onSelect, onViewInventory, onRequest, userLocation }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[24px] border p-4 text-left transition ${
        selected
          ? "border-gray-900 bg-gray-950 text-white shadow-lg"
          : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{mechanic.name}</p>
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
          <p className={`mt-1 text-xs ${selected ? "text-white/70" : "text-gray-500"}`}>
            {formatMilesFromKm(mechanic.distance_km)}
          </p>
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
          <div className="mt-4 rounded-[20px] bg-white/10 px-3 py-3 text-xs text-white/75">
            Pickup: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/mechanics/${mechanic.mechanic_id}`, { state: { mechanic, userLocation } });
              }}
              className="rounded-[18px] bg-white px-3 py-2 text-xs font-medium text-gray-900"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewInventory();
              }}
              className="rounded-[18px] bg-white/15 px-3 py-2 text-xs font-medium text-white"
            >
              Parts
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequest();
              }}
              className="rounded-[18px] bg-[#16a34a] px-3 py-2 text-xs font-medium text-white"
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
    <div className="rounded-[24px] border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-gray-950">{part.part_name}</p>
          <p className="mt-1 text-sm text-gray-500">
            {part.mechanic_name} · {formatMilesFromKm(part.distance_km)} away
          </p>
          <p className="mt-2 text-xs text-gray-400">{part.mechanic_address || "Richmond service area"}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-950">{formatCurrencyUSD(part.price)}</p>
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
              {mechanic.specialization || "General repair"} · {formatMilesFromKm(mechanic.distance_km)} away
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
                      <p className="text-sm font-semibold text-gray-950">{formatCurrencyUSD(part.price)}</p>
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
