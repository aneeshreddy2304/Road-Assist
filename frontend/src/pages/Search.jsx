import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { useLocation } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  Crosshair,
  MapPin,
  MessageCircle,
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
  addVehicle,
  createAppointment,
  createRequest,
  deleteVehicle,
  getMechanicParts,
  getMechanicAvailability,
  getMessageInbox,
  getMessageThread,
  getOwnerHistory,
  getMyVehicles,
  getNearbyMechanics,
  listAppointments,
  searchParts,
  sendMessage,
  suggestParts,
  updateAppointmentStatus,
  updateVehicle,
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
const vehicleDefaults = {
  nickname: "",
  make: "",
  model: "",
  year: 2022,
  license_plate: "",
  vehicle_type: "car",
  fuel_type: "gasoline",
  color: "",
  notes: "",
};

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

async function fetchLocationSuggestions(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Location search failed");
  }

  const data = await response.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

export default function Search() {
  const pageLocation = useLocation();

  const [tab, setTab] = useState("mechanics");
  const [location, setLocation] = useState({ lat: RICHMOND_CENTER[0], lng: RICHMOND_CENTER[1] });
  const [pickupQuery, setPickupQuery] = useState("Richmond, VA 23219");
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupFocused, setPickupFocused] = useState(false);
  const [radius, setRadius] = useState(15);
  const [mechanics, setMechanics] = useState([]);
  const [parts, setParts] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [partQuery, setPartQuery] = useState("");
  const [partFocused, setPartFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partSuggestionsLoading, setPartSuggestionsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [inventoryMechanic, setInventoryMechanic] = useState(null);
  const [chatMechanic, setChatMechanic] = useState(null);
  const [scheduleMechanic, setScheduleMechanic] = useState(null);
  const [ownerVehicles, setOwnerVehicles] = useState([]);
  const [ownerHistory, setOwnerHistory] = useState([]);
  const [ownerAppointments, setOwnerAppointments] = useState([]);
  const [ownerInbox, setOwnerInbox] = useState([]);
  const [ownerWorkspaceLoading, setOwnerWorkspaceLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleEditingId, setVehicleEditingId] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(vehicleDefaults);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [appointmentToManage, setAppointmentToManage] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const selectedDetail = selected;

  const pickupLabel =
    pickupQuery === "Current location" ? "Current location · Richmond, VA" : pickupQuery || "Richmond, VA";

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
        setPickupQuery("Current location");
        setGeoLoading(false);
      },
      (error) => {
        let message = "Could not fetch your current location.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Location access is blocked in your browser. Allow location for this site and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your browser could not determine your location. Enter a street address or ZIP code instead.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Enter a street address or ZIP code instead.";
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

  const loadOwnerWorkspace = async () => {
    setOwnerWorkspaceLoading(true);
    const [vehiclesRes, historyRes, appointmentsRes, inboxRes] = await Promise.allSettled([
      getMyVehicles(),
      getOwnerHistory(),
      listAppointments(),
      getMessageInbox(),
    ]);

    if (vehiclesRes.status === "fulfilled") {
      setOwnerVehicles(vehiclesRes.value.data);
    } else {
      console.error(vehiclesRes.reason);
      setOwnerVehicles([]);
    }

    if (historyRes.status === "fulfilled") {
      setOwnerHistory(historyRes.value.data);
    } else {
      console.error(historyRes.reason);
      setOwnerHistory([]);
    }

    if (appointmentsRes.status === "fulfilled") {
      setOwnerAppointments(appointmentsRes.value.data);
    } else {
      console.error(appointmentsRes.reason);
      setOwnerAppointments([]);
    }

    if (inboxRes.status === "fulfilled") {
      setOwnerInbox(inboxRes.value.data);
    } else {
      console.error(inboxRes.reason);
      setOwnerInbox([]);
    }

    setOwnerWorkspaceLoading(false);
  };

  useEffect(() => {
    loadOwnerWorkspace();
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
    const query = pickupQuery.trim();
    if (!pickupFocused || query.length < 3 || query === "Current location") {
      setPickupSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setPickupLoading(true);
      try {
        const suggestions = await fetchLocationSuggestions(query);
        setPickupSuggestions(suggestions);
      } catch (error) {
        console.error(error);
      } finally {
        setPickupLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [pickupQuery, pickupFocused]);

  useEffect(() => {
    if (tab !== "parts") return;
    const trimmed = partQuery.trim();
    if (!trimmed) {
      setPartSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setPartSuggestionsLoading(true);
      try {
        const res = await suggestParts({
          q: trimmed,
          lat: location.lat,
          lng: location.lng,
          radius_km: radius,
        });
        setPartSuggestions(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setPartSuggestionsLoading(false);
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
        if (!prev) return null;
        return res.data.find((item) => item.mechanic_id === prev.mechanic_id) || null;
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

    setPartSuggestions([]);
    setPartFocused(false);
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

  const applyPartSuggestion = async (suggestion) => {
    setPartQuery(suggestion.part_name);
    setPartSuggestions([]);
    setPartFocused(false);
    await fetchParts(suggestion.part_name);
  };

  const applyPickupSuggestion = (suggestion) => {
    setPickupQuery(suggestion.label);
    setLocation({ lat: suggestion.lat, lng: suggestion.lng });
    setPickupSuggestions([]);
    setPickupFocused(false);
    setGeoError("");
  };

  const openRoute = (mechanic) => {
    const url = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${mechanic.lat},${mechanic.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSelectMechanic = (mechanic) => {
    setSelected(mechanic);
  };

  const handleDeselectMechanic = (mechanic) => {
    if (selected?.mechanic_id === mechanic.mechanic_id) {
      setSelected(null);
    }
  };

  const resetVehicleForm = () => {
    setVehicleEditingId(null);
    setVehicleForm(vehicleDefaults);
    setVehicleFormOpen(false);
  };

  const startVehicleEdit = (vehicle) => {
    setVehicleEditingId(vehicle.id);
    setVehicleForm({
      nickname: vehicle.nickname || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year || 2022,
      license_plate: vehicle.license_plate || "",
      vehicle_type: vehicle.vehicle_type || "car",
      fuel_type: vehicle.fuel_type || "gasoline",
      color: vehicle.color || "",
      notes: vehicle.notes || "",
    });
    setVehicleFormOpen(true);
  };

  const handleVehicleSubmit = async (payload) => {
    setVehicleSaving(true);
    try {
      const vehiclePayload = { ...payload, year: Number(payload.year) };
      const response = vehicleEditingId
        ? await updateVehicle(vehicleEditingId, vehiclePayload)
        : await addVehicle(vehiclePayload);
      setOwnerVehicles((current) =>
        vehicleEditingId
          ? current.map((item) => (item.id === vehicleEditingId ? response.data : item))
          : [response.data, ...current]
      );
      resetVehicleForm();
    } finally {
      setVehicleSaving(false);
    }
  };

  const handleVehicleDelete = async (vehicleId) => {
    if (!window.confirm("Remove this vehicle from your garage?")) return;
    await deleteVehicle(vehicleId);
    setOwnerVehicles((current) => current.filter((item) => item.id !== vehicleId));
  };

  const filteredOwnerHistory = ownerHistory.filter((item) => {
    if (historyFilter === "all") return true;
    return item.status === historyFilter;
  });

  const ownerPendingAppointments = ownerAppointments.filter((appointment) =>
    ["requested", "confirmed"].includes(appointment.status)
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#eef2f7]">
      <section className="relative h-[calc(100vh-56px)] min-h-[52rem] overflow-hidden">
      <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        <MapViewport center={mapCenter} zoom={selectedDetail ? 11 : 12} />
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        <Marker position={[location.lat, location.lng]} icon={ownerIcon}>
          <Popup>Pickup location</Popup>
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
            eventHandlers={{
              click: () => handleSelectMechanic(mechanic),
              dblclick: () => handleDeselectMechanic(mechanic),
            }}
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
            pathOptions={{ color: "#111827", weight: 4, opacity: 0.65 }}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/15" />

      <div className="absolute left-4 top-4 bottom-4 z-[500] flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-4 lg:left-6 lg:top-6 lg:bottom-6">
        <Card className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-2xl backdrop-blur">
          <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-gray-100 p-1">
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

          <div className="relative mt-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Pickup location
            </label>
            <div className="flex items-center gap-2 rounded-[22px] border border-gray-200 bg-white px-4">
              <MapPin size={16} className="text-gray-400" />
              <input
                value={pickupQuery}
                onChange={(e) => setPickupQuery(e.target.value)}
                onFocus={() => setPickupFocused(true)}
                placeholder="Enter street address or ZIP code"
                className="h-14 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>

            {(pickupFocused || pickupLoading) && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-2xl">
                {pickupLoading ? (
                  <div className="px-4 py-4 text-sm text-gray-500">Searching nearby places...</div>
                ) : pickupSuggestions.length > 0 ? (
                  pickupSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyPickupSuggestion(suggestion)}
                      className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                    </button>
                  ))
                ) : pickupQuery.trim().length >= 3 ? (
                  <div className="px-4 py-4 text-sm text-gray-500">No matching address yet. Try a street name or ZIP code.</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={requestCurrentLocation}
              disabled={geoLoading}
              className="inline-flex items-center gap-2 rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            >
              <Crosshair size={15} />
              {geoLoading ? "Locating..." : "Use current location"}
            </button>
            {selectedDetail ? (
              <button
                onClick={() => openRoute(selectedDetail)}
                className="inline-flex items-center gap-2 rounded-[18px] bg-[#0f172a] px-4 py-3 text-sm font-medium text-white transition hover:bg-black"
              >
                <Navigation size={15} />
                Route
              </button>
            ) : null}
          </div>

          {tab === "parts" ? (
            <div className="relative mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Search parts
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="flex items-center gap-2 rounded-[22px] border border-gray-200 bg-white px-4">
                    <SearchIcon size={16} className="text-gray-400" />
                    <input
                      value={partQuery}
                      onChange={(e) => setPartQuery(e.target.value)}
                      onFocus={() => setPartFocused(true)}
                      onBlur={() => {
                        window.setTimeout(() => setPartFocused(false), 120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          fetchParts();
                        }
                      }}
                      placeholder="Search brake pads, battery, oxygen sensor..."
                      className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </div>

                  {partFocused && (partQuery.trim() || partSuggestionsLoading) && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-2xl">
                      {partSuggestionsLoading ? (
                        <div className="px-4 py-4 text-sm text-gray-500">Looking for nearby parts...</div>
                      ) : partSuggestions.length > 0 ? (
                        partSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.part_name}-${suggestion.part_number ?? "none"}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyPartSuggestion(suggestion)}
                            className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">{suggestion.part_name}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {suggestion.mechanic_count} mechanic{suggestion.mechanic_count === 1 ? "" : "s"} nearby · {formatMilesFromKm(suggestion.closest_distance_km)}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-sm text-gray-500">
                          Keep typing. Search now supports close matches and minor spelling mistakes.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => fetchParts()}
                  className="rounded-[22px] bg-[#16a34a] px-5 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Search
                </button>
              </div>
            </div>
          ) : null}

          {geoError ? (
            <p className="mt-4 rounded-[18px] bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
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

        {tab === "mechanics" || parts.length > 0 ? (
        <Card className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-2xl backdrop-blur">
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

          <div className="h-full min-h-0 space-y-3 overflow-y-auto pr-1">
            {!loading && tab === "mechanics" && mechanics.length === 0 ? (
              <EmptyState
                icon="🗺️"
                title="No mechanics nearby yet"
                subtitle="Try a wider radius or search using a different pickup address."
              />
            ) : null}

            {tab === "mechanics" &&
              mechanics.map((mechanic) => (
                <MechanicCard
                  key={mechanic.mechanic_id}
                  mechanic={mechanic}
                  selected={selected?.mechanic_id === mechanic.mechanic_id}
                  onSelect={() => handleSelectMechanic(mechanic)}
                  onDeselect={() => handleDeselectMechanic(mechanic)}
                />
              ))}

            {!loading && tab === "parts" && partQuery && parts.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No matching parts nearby"
                subtitle="Try one of the suggestions above, or use a shorter search term."
              />
            ) : null}

            {tab === "parts" &&
              parts.map((part, index) => (
                <PartCard key={`${part.mechanic_id}-${part.part_name}-${index}`} part={part} />
              ))}
          </div>
        </Card>
        ) : null}
      </div>

      {selectedDetail ? (
        <div className="absolute right-4 top-4 bottom-4 z-[500] hidden w-[26rem] max-w-[calc(100vw-2rem)] lg:right-6 lg:top-6 lg:bottom-6 lg:block">
          <SelectedMechanicPanel
            mechanic={selectedDetail}
            pickupLabel={pickupLabel}
            onOpenRoute={() => openRoute(selectedDetail)}
            onOpenInventory={() => setInventoryMechanic(selectedDetail)}
            onOpenChat={() => setChatMechanic(selectedDetail)}
            onOpenSchedule={() => setScheduleMechanic(selectedDetail)}
            onRequest={() => {
              setSelected(selectedDetail);
              setShowRequest(true);
            }}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : null}

      {selectedDetail ? (
        <div className="absolute inset-x-4 bottom-4 z-[500] lg:hidden">
          <SelectedMechanicPanel
            mechanic={selectedDetail}
            pickupLabel={pickupLabel}
            onOpenRoute={() => openRoute(selectedDetail)}
            onOpenInventory={() => setInventoryMechanic(selectedDetail)}
            onOpenChat={() => setChatMechanic(selectedDetail)}
            onOpenSchedule={() => setScheduleMechanic(selectedDetail)}
            onRequest={() => {
              setSelected(selectedDetail);
              setShowRequest(true);
            }}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : null}

      {showRequest && selectedDetail ? (
        <RequestModal
          mechanic={selectedDetail}
          userLocation={location}
          onSuccess={loadOwnerWorkspace}
          onClose={() => setShowRequest(false)}
        />
      ) : null}

      {inventoryMechanic ? (
        <MechanicInventoryModal mechanic={inventoryMechanic} onClose={() => setInventoryMechanic(null)} />
      ) : null}

      {chatMechanic ? (
        <MechanicChatModal mechanic={chatMechanic} onClose={() => setChatMechanic(null)} />
      ) : null}

      {scheduleMechanic ? (
        <ScheduleAppointmentModal
          mechanic={scheduleMechanic}
          onSuccess={loadOwnerWorkspace}
          onClose={() => setScheduleMechanic(null)}
        />
      ) : null}
      {appointmentToManage ? (
        <ManageAppointmentModal
          appointment={appointmentToManage}
          onSuccess={loadOwnerWorkspace}
          onClose={() => setAppointmentToManage(null)}
        />
      ) : null}
      {vehicleFormOpen ? (
        <VehicleManagerModal
          initialValues={vehicleForm}
          editing={Boolean(vehicleEditingId)}
          saving={vehicleSaving}
          onClose={resetVehicleForm}
          onSubmit={handleVehicleSubmit}
          onChange={setVehicleForm}
        />
      ) : null}
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <OwnerSurfaceCard
            eyebrow="Service history"
            title="Recent requests"
            loading={ownerWorkspaceLoading}
            itemCount={filteredOwnerHistory.length}
            emptyTitle="No service requests yet"
            emptySubtitle="Accepted, in-progress, and completed services will show up here."
            action={(
              <div className="inline-flex rounded-full bg-[#f8fbff] p-1 ring-1 ring-[#dbe7ff]">
                {[
                  { id: "all", label: "All" },
                  { id: "requested", label: "Requested" },
                  { id: "accepted", label: "Accepted" },
                  { id: "completed", label: "Completed" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setHistoryFilter(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      historyFilter === item.id ? "bg-[#0f172a] text-white" : "text-slate-500 hover:bg-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          >
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {filteredOwnerHistory.map((item) => (
                <div key={item.request_id} className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">
                        {item.status.replace("_", " ")}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {item.request_ref || `RA-${item.request_id.slice(0, 8).toUpperCase()}`}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#081224]">{item.problem_desc}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.mechanic_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.vehicle_label} · {item.license_plate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-[#081224]">
                        {item.status === "completed"
                          ? formatCurrencyUSD(item.total_cost || 0)
                          : item.estimated_cost
                            ? `${formatCurrencyUSD(item.estimated_cost)} est.`
                            : "Estimate pending"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <button
                        onClick={() =>
                          setChatMechanic({
                            mechanic_id: item.mechanic_id,
                            name: item.mechanic_name,
                            address: "",
                            request_id: item.request_id,
                            request_ref: item.request_ref || `RA-${item.request_id.slice(0, 8).toUpperCase()}`,
                          })
                        }
                        className="mt-3 rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Open chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OwnerSurfaceCard>

          <OwnerSurfaceCard
            eyebrow="Messages"
            title="Mechanic inbox"
            loading={ownerWorkspaceLoading}
            itemCount={ownerInbox.length}
            emptyTitle="No mechanic replies yet"
            emptySubtitle="Messages from mechanics and estimate notes will show up here."
          >
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {ownerInbox.map((thread) => (
                <div key={thread.id} className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#081224]">{thread.counterpart_name}</p>
                      {thread.request_ref ? (
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
                          {thread.request_ref}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-500">{thread.counterpart_address || "Richmond service area"}</p>
                      <p className="mt-3 text-sm text-slate-700">{thread.message}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(thread.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setChatMechanic({
                          mechanic_id: thread.mechanic_id,
                          name: thread.counterpart_name,
                          address: thread.counterpart_address,
                          request_id: thread.request_id || null,
                          request_ref: thread.request_ref || null,
                        })
                      }
                      className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Open chat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </OwnerSurfaceCard>

          <OwnerSurfaceCard
            action={(
              <button
                onClick={() => {
                  setVehicleEditingId(null);
                  setVehicleForm(vehicleDefaults);
                  setVehicleFormOpen(true);
                }}
                className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white"
              >
                Add vehicle
              </button>
            )}
            eyebrow="Vehicles"
            title="Vehicle garage"
            loading={ownerWorkspaceLoading}
            itemCount={ownerVehicles.length}
            emptyTitle="No vehicles added"
            emptySubtitle="Add vehicles here so you can request roadside help faster."
          >
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {ownerVehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#081224]">
                        {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.license_plate}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {vehicle.vehicle_type} · {vehicle.fuel_type || "fuel not set"} · {vehicle.color || "color not set"}
                      </p>
                      {vehicle.notes ? <p className="mt-2 text-sm text-slate-500">{vehicle.notes}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startVehicleEdit(vehicle)}
                        className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleVehicleDelete(vehicle.id)}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OwnerSurfaceCard>

          <OwnerSurfaceCard
            action={(
              <span className="rounded-full bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                {ownerPendingAppointments.length} active
              </span>
            )}
            eyebrow="Appointments"
            title="Booked services"
            loading={ownerWorkspaceLoading}
            itemCount={ownerAppointments.length}
            emptyTitle="No future appointments"
            emptySubtitle="Use the Schedule action on a mechanic to reserve a future service slot."
          >
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {ownerAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">
                        {appointment.status}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#081224]">{appointment.service_type}</p>
                      <p className="mt-1 text-sm text-slate-600">{appointment.mechanic_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(appointment.scheduled_for).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {appointment.estimated_cost ? (
                        <p className="mt-2 text-sm font-medium text-emerald-700">
                          Estimate: {formatCurrencyUSD(appointment.estimated_cost)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      {["requested", "confirmed"].includes(appointment.status) ? (
                        <>
                          <button
                            onClick={() => setAppointmentToManage(appointment)}
                            className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Manage
                          </button>
                          <button
                            onClick={async () => {
                              await updateAppointmentStatus(appointment.id, { status: "cancelled" });
                              await loadOwnerWorkspace();
                            }}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OwnerSurfaceCard>
        </div>
      </section>
    </div>
  );
}

function OwnerSurfaceCard({ eyebrow, title, loading, itemCount, emptyTitle, emptySubtitle, children, action = null, className = "" }) {
  return (
    <Card className={`min-h-[24rem] rounded-[28px] border border-[#dbe7ff] bg-white/96 p-5 shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#081224]">{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-4">
        {loading ? <Spinner /> : itemCount ? children : <EmptyState icon="🧾" title={emptyTitle} subtitle={emptySubtitle} />}
      </div>
    </Card>
  );
}

function SelectedMechanicPanel({
  mechanic,
  pickupLabel,
  onOpenRoute,
  onOpenInventory,
  onOpenChat,
  onOpenSchedule,
  onRequest,
  onClose,
}) {
  return (
    <Card className="flex h-full flex-col rounded-[28px] border border-white/80 bg-white/96 p-5 shadow-2xl backdrop-blur">
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
          <h2 className="mt-3 text-[2.1rem] font-semibold leading-tight text-gray-950">{mechanic.name}</h2>
          <p className="mt-1 text-base text-gray-600">{mechanic.specialization || "General repair"}</p>
          <p className="mt-2 text-sm text-gray-500">{mechanic.address || "Richmond service area"}</p>
        </div>

        <div className="flex items-start gap-3">
          <div className="rounded-[22px] bg-gray-100 px-4 py-3 text-right">
            <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
              <Star size={16} className="fill-yellow-400 text-yellow-400" />
              {mechanic.rating}
            </div>
            <p className="mt-1 text-xs text-gray-500">{mechanic.total_reviews || 0} reviews</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
            aria-label="Close selected mechanic"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[22px] bg-gray-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Pickup address</p>
          <p className="mt-2 text-base font-medium text-gray-900">{pickupLabel}</p>
        </div>
        <div className="rounded-[22px] bg-gray-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Mechanic address</p>
          <p className="mt-2 text-base font-medium text-gray-900">{mechanic.address || "Richmond service area"}</p>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
        <button
          onClick={onOpenRoute}
          className="rounded-[18px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Route
        </button>
        <button
          onClick={onOpenInventory}
          className="rounded-[18px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Parts
        </button>
        <button
          onClick={onOpenChat}
          className="rounded-[18px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Message
        </button>
        <button
          onClick={onOpenSchedule}
          className="rounded-[18px] border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Schedule
        </button>
        <button
          onClick={onRequest}
          className="col-span-2 rounded-[18px] bg-[#0f172a] px-3 py-3 text-sm font-medium text-white transition hover:bg-black"
        >
          Request
        </button>
      </div>
    </Card>
  );
}

function MechanicCard({ mechanic, selected, onSelect, onDeselect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDeselect}
      className={`w-full rounded-[22px] border p-4 text-left transition ${
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

    </button>
  );
}

function PartCard({ part }) {
  return (
    <div className="rounded-[22px] border border-gray-200 bg-white p-4">
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

function RequestModal({ mechanic, userLocation, onSuccess, onClose }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [problemDesc, setProblemDesc] = useState("");
  const [requestedCompletionHours, setRequestedCompletionHours] = useState(6);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const extractErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join(", ");
    }
    if (detail && typeof detail === "object") {
      return detail.message || JSON.stringify(detail);
    }
    return err?.message || "Failed to create request";
  };

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
        mechanic_id: mechanic.mechanic_id,
        problem_desc: problemDesc,
        lat: userLocation.lat,
        lng: userLocation.lng,
        requested_completion_hours: requestedCompletionHours || null,
      });
      await onSuccess?.();
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err));
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

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Requested completion window</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={requestedCompletionHours}
                    onChange={(e) => setRequestedCompletionHours(Number(e.target.value))}
                    className="h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                    hours from now
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Mechanics will see this deadline and get an alert when less than 3 hours remain.
                </p>
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

function MechanicChatModal({ mechanic, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = async () => {
    try {
      const response = await getMessageThread({
        mechanic_id: mechanic.mechanic_id,
        request_id: mechanic.request_id || null,
      });
      setMessages(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = window.setInterval(loadMessages, 10000);
    return () => window.clearInterval(interval);
  }, [mechanic.mechanic_id]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await sendMessage({
        mechanic_id: mechanic.mechanic_id,
        request_id: mechanic.request_id || null,
        message: draft.trim(),
      });
      setMessages((current) => [...current, response.data]);
      setDraft("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="flex h-[36rem] w-full max-w-2xl flex-col rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Chat with mechanic</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-950">{mechanic.name}</h3>
            {mechanic.request_ref ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
                {mechanic.request_ref}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-gray-500">Talk about pricing, timing, or the issue before dispatch.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fbff] px-6 py-5">
          {loading ? <Spinner /> : null}
          {!loading && messages.length === 0 ? (
            <EmptyState icon="💬" title="No messages yet" subtitle="Start the conversation with a price or timing question." />
          ) : null}
          {!loading &&
            messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-[22px] px-4 py-3 ${
                  message.sender_role === "owner"
                    ? "ml-auto bg-[#0f172a] text-white"
                    : "bg-white text-gray-900 ring-1 ring-[#dbe7ff]"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{message.sender_name}</p>
                {message.request_ref ? (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{message.request_ref}</p>
                ) : null}
                <p className="mt-2 text-sm leading-6">{message.message}</p>
                <p className={`mt-2 text-[11px] ${message.sender_role === "owner" ? "text-white/70" : "text-gray-400"}`}>
                  {new Date(message.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
        </div>

        <form onSubmit={handleSend} className="border-t border-gray-100 px-6 py-4">
          {error ? <p className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Ask about price estimates, service time, or any repair details..."
              className="min-h-[3.5rem] flex-1 rounded-[20px] border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-[20px] bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VehicleManagerModal({ initialValues, editing, saving, onClose, onSubmit, onChange }) {
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(initialValues);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save vehicle");
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Vehicle garage</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-950">{editing ? "Edit vehicle" : "Add vehicle"}</h3>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ["nickname", "Nickname"],
            ["make", "Make"],
            ["model", "Model"],
            ["year", "Year", "number"],
            ["license_plate", "License plate"],
            ["color", "Color"],
          ].map(([field, label, type = "text"]) => (
            <label key={field} className="block text-sm font-medium text-gray-700">
              {label}
              <input
                type={type}
                value={initialValues[field]}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    [field]: type === "number" ? Number(event.target.value) : event.target.value,
                  }))
                }
                className="mt-2 h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>
          ))}

          <label className="block text-sm font-medium text-gray-700">
            Vehicle type
            <select
              value={initialValues.vehicle_type}
              onChange={(event) => onChange((current) => ({ ...current, vehicle_type: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {["car", "bike", "suv", "truck", "other"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Fuel type
            <select
              value={initialValues.fuel_type}
              onChange={(event) => onChange((current) => ({ ...current, fuel_type: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {["gasoline", "diesel", "hybrid", "electric", "other"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 block text-sm font-medium text-gray-700">
            Notes
            <textarea
              rows={3}
              value={initialValues.notes}
              onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Useful details about this vehicle..."
            />
          </label>

          {error ? <p className="md:col-span-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-[#111827] py-3 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageAppointmentModal({ appointment, onSuccess, onClose }) {
  const [selectedDate, setSelectedDate] = useState(
    new Date(appointment.scheduled_for).toISOString().slice(0, 10)
  );
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(appointment.scheduled_for);
  const [notes, setNotes] = useState(appointment.notes || "");
  const [serviceType, setServiceType] = useState(appointment.service_type);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSlots = async () => {
      setLoadingSlots(true);
      setError("");
      try {
        const response = await getMechanicAvailability({
          mechanic_id: appointment.mechanic_id,
          day: selectedDate,
        });
        setSlots(response.data);
        const stillAvailable = response.data.find((slot) => slot.starts_at === selectedSlot);
        setSelectedSlot(stillAvailable ? selectedSlot : response.data[0]?.starts_at || "");
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load appointment slots");
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [appointment.mechanic_id, selectedDate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateAppointmentStatus(appointment.id, {
        status: appointment.status,
        scheduled_for: selectedSlot,
        notes,
        service_type: serviceType,
      });
      await onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Manage appointment</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-950">{appointment.mechanic_name}</h3>
            <p className="mt-1 text-sm text-gray-500">Adjust the date, time, or service details without cancelling the booking.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Service date
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Service type
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Available slots</label>
            <div className="rounded-[22px] border border-gray-200 bg-[#f8fbff] p-3">
              {loadingSlots ? (
                <div className="py-6 text-sm text-gray-500">Checking updated slots...</div>
              ) : slots.length === 0 ? (
                <div className="py-6 text-sm text-gray-500">No open slots on this date. Try another day.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.starts_at}
                      type="button"
                      onClick={() => setSelectedSlot(slot.starts_at)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        selectedSlot === slot.starts_at
                          ? "bg-[#0f172a] text-white"
                          : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Clock3 size={14} />
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </label>

          {error ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-[#111827] py-3 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleAppointmentModal({ mechanic, onSuccess, onClose }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [serviceType, setServiceType] = useState("General service");
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyVehicles().then((response) => {
      setVehicles(response.data);
      if (response.data.length > 0) setVehicleId(response.data[0].id);
    });
  }, []);

  useEffect(() => {
    const loadSlots = async () => {
      setLoadingSlots(true);
      setError("");
      try {
        const response = await getMechanicAvailability({
          mechanic_id: mechanic.mechanic_id,
          day: selectedDate,
        });
        setSlots(response.data);
        setSelectedSlot(response.data[0]?.starts_at || "");
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load appointment slots");
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [mechanic.mechanic_id, selectedDate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      await createAppointment({
        mechanic_id: mechanic.mechanic_id,
        vehicle_id: vehicleId || null,
        scheduled_for: selectedSlot,
        service_type: serviceType,
        notes: notes || null,
      });
      await onSuccess?.();
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to schedule appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
        {success ? (
          <div className="py-6 text-center">
            <div className="mb-3 text-4xl">🗓️</div>
            <h3 className="text-2xl font-semibold text-gray-950">Appointment requested</h3>
            <p className="mt-2 text-sm text-gray-500">The mechanic can now see this future service slot in their system.</p>
            <button onClick={onClose} className="mt-5 rounded-2xl bg-[#111827] px-6 py-3 text-sm font-medium text-white">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Schedule future service</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-950">{mechanic.name}</h3>
                <p className="mt-1 text-sm text-gray-500">Choose a future time that fits the mechanic’s published work hours.</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle</label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
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
                  <label className="mb-2 block text-sm font-medium text-gray-700">Service date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Service type</label>
                <input
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Available slots</label>
                <div className="rounded-[22px] border border-gray-200 bg-[#f8fbff] p-3">
                  {loadingSlots ? (
                    <div className="py-6 text-sm text-gray-500">Checking the mechanic’s open slots...</div>
                  ) : slots.length === 0 ? (
                    <div className="py-6 text-sm text-gray-500">No open slots on this date. Try another day.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.starts_at}
                          type="button"
                          onClick={() => setSelectedSlot(slot.starts_at)}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                            selectedSlot === slot.starts_at
                              ? "bg-[#0f172a] text-white"
                              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <Clock3 size={14} />
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Notes for mechanic</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Mention service package, budget expectations, or anything important..."
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
                  disabled={saving || !selectedSlot}
                  className="rounded-2xl bg-[#111827] py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Scheduling..." : "Request appointment"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
