import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { CalendarDays, CarFront, ChevronDown, ClipboardList, Crosshair, ExternalLink, HeartPulse, MapPin, MessageCircle, Package, Phone, Search, ShoppingBag, UserRound, Wrench, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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
  const route = useLocation();
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
  const heading = view === "services" ? "Find help" : "Parts shop";
  return (
    <main className="owner-pearl-app">
      <aside className="owner-pearl-sidebar">
        <Link className="owner-pearl-brand" to="/explore"><span><Wrench size={19} /></span><div><small>ROAD COMPANION</small><strong>wingman</strong></div></Link>
        <button className="owner-pearl-selector"><span><CarFront size={18} /></span><div><small>WORKSPACE</small><strong>Vehicle owner</strong></div><ChevronDown size={16} /></button>
        <p className="owner-pearl-caption">YOUR ROAD COMPANION</p>
        <nav className="owner-pearl-nav" aria-label="Owner workspace">
          <button className={view === "services" ? "active" : ""} onClick={() => setView("services")}><MapPin size={19} /> Find help</button>
          <Link to="/my-requests"><ClipboardList size={19} /> My requests</Link>
          <Link to="/vehicles"><CarFront size={19} /> My garage</Link>
          <Link to="/vehicles"><HeartPulse size={19} /> Vehicle Care</Link>
          <Link to="/my-requests"><CalendarDays size={19} /> Appointments</Link>
          <button className={view === "parts" ? "active" : ""} onClick={() => setView("parts")}><ShoppingBag size={19} /> Parts shop</button>
          <Link to="/profile"><MessageCircle size={19} /> Messages</Link>
          <Link to="/profile"><UserRound size={19} /> Profile</Link>
        </nav>
        <div className="owner-pearl-account"><span>{"" + (route.pathname === "/explore" ? "JE" : "OW")}</span><div><strong>Demo account</strong><small>Owner workspace</small></div><ChevronDown size={16} /></div>
      </aside>
      <section className="owner-pearl-content">
        <header className="owner-pearl-title"><div><p>CALIFORNIA DIRECTORY</p><h1>{heading}</h1></div>{view === "services" ? <button onClick={useLocation}><Crosshair size={17} /> Use my location</button> : null}</header>
        <div className="owner-pearl-disclaimer">Demo directory: public business names and service details, with synthetic Wingman contact routes. No real business is contacted.</div>

        {notice ? <div className="owner-pearl-notice"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button></div> : null}

        <section className="owner-pearl-searchbar"><button className="owner-pearl-location"><MapPin size={18} /> California, United States <ChevronDown size={16} /></button><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "services" ? "Search providers…" : "Search oil, battery, brakes…"} /></label><button onClick={useLocation}><Crosshair size={17} /> Use my location</button></section>
        {view === "services" ? <div className="owner-pearl-chips">{categories.map(([id, label]) => <button key={id} onClick={() => setCategory(id)} className={category === id ? "selected" : ""}>{id === "all" ? "All providers" : label}</button>)}</div> : null}

        <div className="owner-pearl-finder">
          <section className="owner-pearl-results">
              <div className="owner-pearl-results-heading"><strong>{visible.length} {view === "services" ? "providers" : "products"} nearby</strong><span>Closest first</span></div>
              {loading ? <Spinner /> : visible.length === 0 ? <EmptyState icon="⌕" title="No matches" subtitle="Try a broader category or a different search." /> : view === "services" ? <div className="space-y-3">{providers.map((provider) => <ProviderRow key={provider.id} provider={provider} active={selected?.id === provider.id} onSelect={() => { setSelected(provider); setCenter({ lat: provider.lat, lng: provider.lng }); }} onBook={() => { loadOwnerWorkspace(); setBookingProvider(provider); }} />)}</div> : <div className="grid gap-3 sm:grid-cols-2">{parts.map((part) => <PartTile key={part.id} part={part} onOrder={() => { loadOwnerWorkspace(); setOrderPart(part); }} />)}</div>}
          </section>
          <section className="owner-pearl-map">
            <MapContainer center={[CALIFORNIA.lat, CALIFORNIA.lng]} zoom={6} zoomControl={false} className="h-[32rem] w-full" scrollWheelZoom>
              <MapViewport center={center} />
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {providers.map((provider) => <CircleMarker key={provider.id} center={[provider.lat, provider.lng]} radius={selected?.id === provider.id ? 11 : 8} pathOptions={{ color: "#f4f1ea", weight: 2, fillColor: provider.category === "parts" ? "#59646a" : "#252a2e", fillOpacity: 1 }} eventHandlers={{ click: () => { setSelected(provider); setCenter({ lat: provider.lat, lng: provider.lng }); } }}><Popup><strong>{provider.name}</strong><br />{provider.category} · {provider.city}<br />{provider.services.slice(0, 2).join(" · ")}</Popup></CircleMarker>)}
            </MapContainer>
            <div className="owner-pearl-map-label"><i /> California providers · demo directory</div>
          </section>
        </div>

        <section className="owner-pearl-orders">
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
