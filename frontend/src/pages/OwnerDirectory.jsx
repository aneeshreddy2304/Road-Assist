import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { CalendarDays, Crosshair, ExternalLink, MapPin, Package, Phone, Search, ShoppingBag, Wrench, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

import {
  createOwnerPartOrder,
  createProviderBooking,
  getMyVehicles,
  getOwnerDirectoryProviders,
  getOwnerMarketplaceParts,
  getOwnerPartOrders,
  getProviderBookings,
} from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const CALIFORNIA = { lat: 36.7783, lng: -119.4179 };
const categories = [
  ["all", "All services"], ["repair", "Repair"], ["dealership", "Dealership service"],
  ["tire", "Tires"], ["towing", "Towing"], ["parts", "Parts stores"],
];

function MapViewport({ center }) {
  const map = useMap();
  useEffect(() => { map.flyTo([center.lat, center.lng], center === CALIFORNIA ? 6 : 11, { duration: 0.8 }); }, [center, map]);
  return null;
}

export default function OwnerDirectory() {
  const [view, setView] = useState("services");
  const [providers, setProviders] = useState([]);
  const [parts, setParts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState(CALIFORNIA);
  const [selected, setSelected] = useState(null);
  const [orderPart, setOrderPart] = useState(null);
  const [bookingProvider, setBookingProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      // Let the map and catalog arrive independently of private account data.
      // This keeps the California directory useful on first view.
      const [providerRes, partRes] = await Promise.all([
        getOwnerDirectoryProviders({ ...center, category, query: query || undefined }),
        getOwnerMarketplaceParts({ query: query || undefined }),
      ]);
      setProviders(providerRes.data); setParts(partRes.data);
    } catch (error) {
      setNotice(error.response?.data?.detail || "The directory could not be loaded. Please try again.");
    } finally { setLoading(false); }
  };

  const loadOwnerWorkspace = async () => {
    try {
      const [vehicleRes, orderRes, bookingRes] = await Promise.all([
        getMyVehicles(), getOwnerPartOrders(), getProviderBookings(),
      ]);
      setVehicles(vehicleRes.data); setOrders(orderRes.data); setBookings(bookingRes.data);
    } catch (error) {
      setNotice(error.response?.data?.detail || "Sign in to view your appointments and orders.");
    }
  };

  useEffect(() => { load(); }, [category, center]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setTimeout(() => load(), 350);
    return () => window.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const useLocation = () => {
    if (!navigator.geolocation) { setNotice("This browser does not support location. California demo locations are shown instead."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      const inCalifornia = lat >= 32.4 && lat <= 42.1 && lng >= -124.6 && lng <= -114.0;
      if (!inCalifornia) {
        setCenter(CALIFORNIA);
        setNotice("Live location is available for the California demo directory only. Showing the California map instead.");
        return;
      }
      setCenter({ lat, lng }); setNotice("Showing providers near your California location.");
    }, () => setNotice("We could not access your location. Showing the California demo directory instead."));
  };

  const visible = view === "services" ? providers : parts;
  const heading = view === "services" ? "Find service that fits the repair." : "Parts for the work you handle yourself.";
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#e8e6df] px-4 py-6 text-[#252a2e] lg:px-8">
      <section className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#59646a]">California demo directory</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-6xl">{heading}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#59646a]">Business names, locations, and listed services are curated for this demo. Contact routes are synthetic and no real business is contacted through Wingman.</p>
          </div>
          <button onClick={useLocation} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#252a2e] px-5 text-sm font-bold text-[#f4f1ea] transition hover:bg-[#3b454c]"><Crosshair size={16} /> Use current location</button>
        </div>

        {notice ? <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-[#aeb8bc] bg-[#f4f1ea] px-4 py-3 text-sm text-[#3b454c]"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button></div> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,.95fr)]">
          <Card className="overflow-hidden rounded-[28px] border-[#aeb8bc] bg-[#f4f1ea] p-0">
            <div className="flex min-h-[29rem] flex-col">
              <div className="border-b border-[#c9d0d3] p-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setView("services")} className={`min-h-10 rounded-full px-4 text-sm font-bold ${view === "services" ? "bg-[#252a2e] text-[#f4f1ea]" : "bg-[#e8e6df] text-[#59646a]"}`}><Wrench className="mr-2 inline" size={15} />Services</button>
                  <button onClick={() => setView("parts")} className={`min-h-10 rounded-full px-4 text-sm font-bold ${view === "parts" ? "bg-[#252a2e] text-[#f4f1ea]" : "bg-[#e8e6df] text-[#59646a]"}`}><Package className="mr-2 inline" size={15} />Parts</button>
                  {view === "services" ? categories.map(([id, label]) => <button key={id} onClick={() => setCategory(id)} className={`min-h-10 rounded-full border px-3 text-xs font-bold ${category === id ? "border-[#3b454c] bg-[#c9d0d3] text-[#252a2e]" : "border-[#c9d0d3] bg-transparent text-[#59646a]"}`}>{label}</button>) : null}
                </div>
                <label className="mt-4 flex min-h-12 items-center gap-2 rounded-2xl border border-[#c9d0d3] bg-white px-4"><Search size={17} className="text-[#59646a]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "services" ? "Search a service or California city" : "Search oil, battery, brakes, wipers"} className="w-full bg-transparent text-sm outline-none placeholder:text-[#879299]" /></label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {loading ? <Spinner /> : visible.length === 0 ? <EmptyState icon="⌕" title="No matches" subtitle="Try a broader category or a different search." /> : view === "services" ? <div className="space-y-3">{providers.map((provider) => <ProviderRow key={provider.id} provider={provider} active={selected?.id === provider.id} onSelect={() => { setSelected(provider); setCenter({ lat: provider.lat, lng: provider.lng }); }} onBook={() => { loadOwnerWorkspace(); setBookingProvider(provider); }} />)}</div> : <div className="grid gap-3 sm:grid-cols-2">{parts.map((part) => <PartTile key={part.id} part={part} onOrder={() => { loadOwnerWorkspace(); setOrderPart(part); }} />)}</div>}
              </div>
            </div>
          </Card>

          <Card className="min-h-[32rem] overflow-hidden rounded-[28px] border-[#aeb8bc] p-0">
            <MapContainer center={[CALIFORNIA.lat, CALIFORNIA.lng]} zoom={6} zoomControl={false} className="h-[32rem] w-full" scrollWheelZoom>
              <MapViewport center={center} />
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {providers.map((provider) => <CircleMarker key={provider.id} center={[provider.lat, provider.lng]} radius={selected?.id === provider.id ? 11 : 8} pathOptions={{ color: "#f4f1ea", weight: 2, fillColor: provider.category === "parts" ? "#59646a" : "#252a2e", fillOpacity: 1 }} eventHandlers={{ click: () => { setSelected(provider); setCenter({ lat: provider.lat, lng: provider.lng }); } }}><Popup><strong>{provider.name}</strong><br />{provider.category} · {provider.city}<br />{provider.services.slice(0, 2).join(" · ")}</Popup></CircleMarker>)}
            </MapContainer>
          </Card>
        </div>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card className="rounded-[28px] border-[#c9d0d3] p-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#59646a]">Your service appointments</p>{bookings.length ? <div className="mt-4 space-y-3">{bookings.slice(0, 3).map((booking) => <p key={booking.id} className="border-t border-[#c9d0d3] pt-3 text-sm"><b>{booking.provider_name}</b> · {booking.service_type}<br /><span className="text-[#59646a]">{new Date(booking.requested_for).toLocaleString()}</span></p>)}</div> : <p className="mt-3 text-sm text-[#59646a]">Book a service-capable repair shop, tire centre, or dealership to see it here.</p>}</Card>
          <Card className="rounded-[28px] border-[#c9d0d3] p-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#59646a]">Your parts orders</p>{orders.length ? <div className="mt-4 space-y-3">{orders.slice(0, 3).map((order) => <p key={order.id} className="border-t border-[#c9d0d3] pt-3 text-sm"><b>{order.order_ref}</b> · {order.product_name}<br /><span className="text-[#59646a]">{order.status} · {formatCurrencyUSD(order.total_price)}</span></p>)}</div> : <p className="mt-3 text-sm text-[#59646a]">Fixed-price orders with your delivery details will appear here.</p>}</Card>
        </section>
      </section>
      {orderPart ? <OrderModal part={orderPart} onClose={() => setOrderPart(null)} onPlaced={() => { setOrderPart(null); setNotice("Order confirmed. It is now visible in Your parts orders."); load(); loadOwnerWorkspace(); }} /> : null}
      {bookingProvider ? <BookingModal provider={bookingProvider} vehicles={vehicles} onClose={() => setBookingProvider(null)} onPlaced={() => { setBookingProvider(null); setNotice("Appointment request saved. It is now visible in Your service appointments."); load(); loadOwnerWorkspace(); }} /> : null}
    </main>
  );
}

function ProviderRow({ provider, active, onSelect, onBook }) { return <article className={`rounded-2xl border p-4 transition ${active ? "border-[#3b454c] bg-[#e8e6df]" : "border-[#c9d0d3] bg-white"}`}><button className="w-full text-left" onClick={onSelect}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black">{provider.name}</p><p className="mt-1 text-sm text-[#59646a]"><MapPin className="mr-1 inline" size={14} />{provider.address}</p></div><span className="rounded-full bg-[#e8e6df] px-2.5 py-1 text-xs font-bold capitalize text-[#3b454c]">{provider.category}</span></div><p className="mt-3 text-sm text-[#3b454c]">{provider.services.join(" · ")}</p></button><div className="mt-4 flex flex-wrap gap-2"><a className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c9d0d3] px-3 text-xs font-bold text-[#3b454c]" href={`tel:${provider.synthetic_phone}`}><Phone size={14} /> Demo contact</a>{provider.website_url ? <a className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c9d0d3] px-3 text-xs font-bold text-[#3b454c]" href={provider.website_url} target="_blank" rel="noreferrer">Website <ExternalLink size={14} /></a> : null}{provider.can_schedule ? <button onClick={onBook} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#252a2e] px-3 text-xs font-bold text-[#f4f1ea]"><CalendarDays size={14} /> Schedule service</button> : null}</div></article>; }
function PartTile({ part, onOrder }) { return <article className="rounded-2xl border border-[#c9d0d3] bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#59646a]">{part.category}</p><h2 className="mt-2 text-lg font-black">{part.name}</h2><p className="mt-1 text-sm text-[#59646a]">{part.brand || ""} · {part.retailer_name}</p><p className="mt-3 text-sm text-[#3b454c]">{part.description}</p><div className="mt-4 flex items-center justify-between gap-3"><span className="text-lg font-black">{formatCurrencyUSD(part.price)}</span><button onClick={onOrder} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#252a2e] px-3 text-xs font-bold text-[#f4f1ea]"><ShoppingBag size={14} /> Order</button></div></article>; }

function OrderModal({ part, onClose, onPlaced }) { const [form, setForm] = useState({ quantity: 1, delivery_name: "", delivery_address: "", delivery_phone: "", delivery_notes: "" }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const set = (key, value) => setForm((current) => ({ ...current, [key]: value })); const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { await createOwnerPartOrder({ product_id: part.id, ...form, quantity: Number(form.quantity) }); onPlaced(); } catch (err) { setError(err.response?.data?.detail || "Could not confirm this order."); } finally { setSaving(false); } }; return <Modal title={`Order ${part.name}`} onClose={onClose}><form onSubmit={submit} className="space-y-3"><p className="text-sm text-[#59646a]">Fixed price: <b className="text-[#252a2e]">{formatCurrencyUSD(part.price)}</b> · {part.retailer_name}</p><Field label="Quantity" type="number" min="1" max="10" value={form.quantity} onChange={(v) => set("quantity", v)} /><Field label="Delivery name" value={form.delivery_name} onChange={(v) => set("delivery_name", v)} /><Field label="Delivery address" value={form.delivery_address} onChange={(v) => set("delivery_address", v)} /><Field label="Delivery phone" value={form.delivery_phone} onChange={(v) => set("delivery_phone", v)} /><Field label="Delivery notes (optional)" value={form.delivery_notes} onChange={(v) => set("delivery_notes", v)} />{error ? <p className="text-sm text-red-700">{error}</p> : null}<button disabled={saving} className="min-h-11 w-full rounded-full bg-[#252a2e] text-sm font-bold text-[#f4f1ea] disabled:opacity-60">{saving ? "Confirming…" : "Confirm fixed-price order"}</button></form></Modal>; }
function BookingModal({ provider, vehicles, onClose, onPlaced }) { const [form, setForm] = useState({ vehicle_id: vehicles[0]?.id || "", requested_for: "", service_type: provider.services[0] || "Service", notes: "" }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const set = (key, value) => setForm((current) => ({ ...current, [key]: value })); const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { await createProviderBooking({ ...form, vehicle_id: form.vehicle_id || null, requested_for: new Date(form.requested_for).toISOString() }); onPlaced(); } catch (err) { setError(err.response?.data?.detail || "Could not save this appointment request."); } finally { setSaving(false); } }; return <Modal title={`Schedule with ${provider.name}`} onClose={onClose}><form onSubmit={submit} className="space-y-3"><label className="block text-sm font-bold">Vehicle<select value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#c9d0d3] bg-white px-3">{vehicles.length ? vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.year} {vehicle.make} {vehicle.model}</option>) : <option value="">No vehicle selected</option>}</select></label><Field label="Requested time" type="datetime-local" value={form.requested_for} onChange={(v) => set("requested_for", v)} /><Field label="Service needed" value={form.service_type} onChange={(v) => set("service_type", v)} /><Field label="Notes (optional)" value={form.notes} onChange={(v) => set("notes", v)} />{error ? <p className="text-sm text-red-700">{error}</p> : null}<button disabled={saving} className="min-h-11 w-full rounded-full bg-[#252a2e] text-sm font-bold text-[#f4f1ea] disabled:opacity-60">{saving ? "Saving…" : "Request appointment"}</button></form></Modal>; }
function Field({ label, ...props }) { return <label className="block text-sm font-bold">{label}<input required={!label.includes("optional")} {...props} className="mt-1 min-h-11 w-full rounded-xl border border-[#c9d0d3] bg-white px-3 text-sm font-normal outline-none focus:border-[#3b454c]" /></label>; }
function Modal({ title, children, onClose }) { return <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#252a2e]/60 p-4"><section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-[28px] bg-[#f4f1ea] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-2xl font-black tracking-tight">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-[#e8e6df]"><X size={18} /></button></div>{children}</section></div>; }
