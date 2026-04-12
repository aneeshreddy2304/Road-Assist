import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, Popup, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { getMechanicParts, getMechanicProfile } from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";

const KM_TO_MILES = 0.621371;

function toMiles(km) {
  const numericKm = Number(km);
  if (!Number.isFinite(numericKm)) return "Not calculated";
  return `${(numericKm * KM_TO_MILES).toFixed(1)} mi`;
}

function mapLink(userLocation, mechanic) {
  if (userLocation?.lat && userLocation?.lng) {
    return `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${mechanic.lat},${mechanic.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${mechanic.lat},${mechanic.lng}`;
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.resolve();
}

export default function MechanicProfile() {
  const { mechanicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const userLocation = location.state?.userLocation || null;

  const [mechanic, setMechanic] = useState(location.state?.mechanic || null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profilePromise = getMechanicProfile(mechanicId, userLocation || undefined);
        const partsPromise = getMechanicParts(mechanicId);
        const [profileRes, partsRes] = await Promise.all([profilePromise, partsPromise]);
        setMechanic(profileRes.data);
        setParts(partsRes.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mechanicId, userLocation]);

  async function handleCopyLocation() {
    if (!mechanic) return;
    const text = `${mechanic.lat}, ${mechanic.lng}`;
    await copyText(text);
    setCopied("Coordinates copied");
    window.setTimeout(() => setCopied(""), 1800);
  }

  if (loading) return <Spinner />;
  if (!mechanic) return <EmptyState icon="🛠️" title="Mechanic not found" subtitle="Try searching again." />;

  const line = userLocation ? [[userLocation.lat, userLocation.lng], [mechanic.lat, mechanic.lng]] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline">
            Back to search
          </button>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{mechanic.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mechanic.specialization || "General repair"} • Rating {mechanic.rating} • {mechanic.total_reviews} reviews
          </p>
        </div>
        <a
          href={mapLink(userLocation, mechanic)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Open Route
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
        <Card className="overflow-hidden">
          <div className="h-[26rem]">
            <MapContainer center={[mechanic.lat, mechanic.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {userLocation ? (
                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>Your shared location</Popup>
                </Marker>
              ) : null}
              <Marker position={[mechanic.lat, mechanic.lng]}>
                <Popup>{mechanic.name}</Popup>
              </Marker>
              {line ? <Polyline positions={line} pathOptions={{ color: "#ea580c", weight: 4 }} /> : null}
            </MapContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Store details</p>
              <p className="mt-2 text-sm text-gray-700">{mechanic.address || "Address not added yet"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Availability</p>
                <p className="mt-1 text-sm font-medium text-gray-800">
                  {mechanic.is_available ? "Available now" : "Currently busy"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Distance</p>
                <p className="mt-1 text-sm font-medium text-gray-800">
                  {toMiles(mechanic.distance_km)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">Exact location shared</p>
              <p className="mt-1 font-mono text-sm text-gray-800">{mechanic.lat}, {mechanic.lng}</p>
              <button onClick={handleCopyLocation} className="mt-2 text-sm text-brand-600 hover:underline">
                Copy coordinates
              </button>
              {copied ? <p className="mt-1 text-xs text-green-600">{copied}</p> : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Available spare parts</h2>
              <span className="text-sm text-gray-400">{parts.length} listed</span>
            </div>
            {parts.length === 0 ? (
              <EmptyState icon="📦" title="No inventory listed" subtitle="This mechanic has not published stock yet." />
            ) : (
              <div className="mt-4 space-y-3">
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
            )}
          </Card>

          <Link
            to="/search"
            state={{ selectedMechanicId: mechanic.mechanic_id }}
            className="inline-flex text-sm text-brand-600 hover:underline"
          >
            Back to all mechanics
          </Link>
        </div>
      </div>
    </div>
  );
}
