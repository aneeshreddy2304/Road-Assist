import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Bell, CalendarClock, Check, ChevronDown, CircleAlert, FileText,
  Gauge, HeartPulse, LoaderCircle, Plus, ReceiptText, Upload, Wrench, X,
} from "lucide-react";
import {
  addServiceRecord, addVehicleCheckin, downloadServiceInvoice, getOwnerNotifications,
  getVehicleCare, markNotificationRead,
} from "../api/endpoints";

const EMPTY_CHECKIN = { odometer_miles: "", note: "" };

function californiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function emptyServiceRecord() {
  return {
    service_date: californiaToday(), odometer_miles: "", provider_name: "", total_cost: "", notes: "",
    next_due_date: "", next_due_miles: "", completed_items: [""], invoice: null,
  };
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatNumber(value) {
  return value === null || value === undefined ? "Not recorded" : `${Number(value).toLocaleString("en-US")} mi`;
}

const STATUS = {
  on_track: { label: "On track", className: "bg-emerald-100 text-emerald-800 ring-emerald-200", icon: Check },
  due_soon: { label: "Due soon", className: "bg-amber-100 text-amber-800 ring-amber-200", icon: CalendarClock },
  service_overdue: { label: "Service overdue", className: "bg-red-100 text-red-800 ring-red-200", icon: CircleAlert },
};

export default function VehicleCare() {
  const { vehicleId } = useParams();
  const [care, setCare] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [careResponse, notificationResponse] = await Promise.all([getVehicleCare(vehicleId), getOwnerNotifications()]);
      setCare(careResponse.data);
      setNotifications(notificationResponse.data.filter((item) => item.vehicle_id === vehicleId && !item.completed_at));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Vehicle Care could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [vehicleId]);

  const markRead = async (notification) => {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch {
      setError("We could not update that notification.");
    }
  };

  if (loading) return <LoadingState />;
  if (error && !care) return <ErrorState message={error} onRetry={load} />;
  const status = STATUS[care.summary.state] || STATUS.on_track;
  const StatusIcon = status.icon;
  const vehicle = care.summary.vehicle;

  return (
    <main className="min-h-screen bg-[#e8e6df] px-4 py-6 text-[#252a2e] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link to="/vehicles" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#59646a] transition hover:text-[#252a2e] focus:outline-none focus:ring-2 focus:ring-[#59646a] focus:ring-offset-4">
          <ArrowLeft size={17} aria-hidden="true" /> All vehicles
        </Link>

        <header className="mt-6 grid gap-6 border-b border-[#c9d0d3] pb-8 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#59646a]">Vehicle Care</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.065em] sm:text-5xl">
              {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#59646a]">Keep service records, monthly mileage, and the details you do not want to forget before the next visit.</p>
          </div>
          <div className={`inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full px-5 text-sm font-bold ring-1 lg:justify-self-end ${status.className}`}>
            <StatusIcon size={17} aria-hidden="true" /> {status.label}
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        {notice ? <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}

        {notifications.length ? (
          <section aria-labelledby="care-notifications" className="mt-6 rounded-3xl border border-[#c9d0d3] bg-[#f4f1ea] p-4 shadow-[0_14px_40px_rgba(37,42,46,.08)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b454c] text-[#f4f1ea]"><Bell size={18} aria-hidden="true" /></span><div><h2 id="care-notifications" className="font-bold">Attention needed</h2><p className="text-sm text-[#59646a]">Complete a check-in or add a service record to resolve the related reminder.</p></div></div>
              <span className="rounded-full bg-[#e1e4e3] px-3 py-1 text-xs font-bold text-[#3b454c]">{notifications.length} active</span>
            </div>
            <div className="mt-4 grid gap-2">
              {notifications.map((item) => <button key={item.id} onClick={() => markRead(item)} className={`flex min-h-12 items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#59646a] ${item.read_at ? "border-[#d7dcdd] bg-white/50" : "border-[#aeb8bc] bg-white"}`}>
                <span><span className="block text-sm font-bold">{item.title}</span><span className="mt-0.5 block text-sm text-[#59646a]">{item.body}</span></span>
                {!item.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#3b454c]" aria-label="Unread" /> : null}
              </button>)}
            </div>
          </section>
        ) : null}

        <section aria-label="Vehicle care status" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Latest odometer" value={formatNumber(care.summary.current_odometer_miles)} icon={<Gauge size={19} />} />
          <Stat label="Last service" value={care.summary.last_service ? formatDate(care.summary.last_service.service_date) : "No record yet"} icon={<Wrench size={19} />} />
          <Stat label="Next due date" value={formatDate(care.summary.next_due_date)} icon={<CalendarClock size={19} />} />
          <Stat label="Next due mileage" value={formatNumber(care.summary.next_due_miles)} icon={<HeartPulse size={19} />} />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[.82fr_1.18fr]">
          <CheckinForm vehicleId={vehicleId} onSaved={() => { setNotice("Monthly check-in saved. The reminder has been resolved."); load(); }} />
          <section className="rounded-[1.75rem] bg-[#252a2e] p-6 text-[#f4f1ea] shadow-[0_20px_55px_rgba(37,42,46,.18)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aeb8bc]">Service record</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.055em]">Every repair has a place.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#d7dcdd]">Save completed work, the invoice, cost, and the next service target in one record.</p>
            <button onClick={() => setShowServiceForm(true)} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#aeb8bc] px-5 py-3 text-sm font-bold text-[#252a2e] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#252a2e]"><Plus size={18} aria-hidden="true" /> Add service record</button>
          </section>
        </section>

        <HistorySection checkins={care.checkins} records={care.service_records} onDownload={async (record) => {
          try {
            const response = await downloadServiceInvoice(record.id);
            const url = URL.createObjectURL(response.data);
            window.open(url, "_blank", "noopener,noreferrer");
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } catch {
            setError("That invoice could not be opened.");
          }
        }} />
      </div>
      {showServiceForm ? <ServiceRecordModal vehicleId={vehicleId} onClose={() => setShowServiceForm(false)} onSaved={() => { setShowServiceForm(false); setNotice("Service record saved. Any active due-service reminder has been resolved."); load(); }} /> : null}
    </main>
  );
}

function Stat({ label, value, icon }) {
  return <article className="min-h-32 rounded-3xl border border-[#c9d0d3] bg-[#f4f1ea] p-5 shadow-[0_10px_28px_rgba(37,42,46,.06)]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e1e4e3] text-[#3b454c]" aria-hidden="true">{icon}</span><p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-[#59646a]">{label}</p><p className="mt-1 text-lg font-black tracking-[-.03em]">{value}</p></article>;
}

function CheckinForm({ vehicleId, onSaved }) {
  const [form, setForm] = useState(EMPTY_CHECKIN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (!form.odometer_miles) { setError("Enter the current odometer reading in miles."); formRef.current?.focus(); return; }
    setSaving(true);
    try { await addVehicleCheckin(vehicleId, { odometer_miles: Number(form.odometer_miles), note: form.note || null }); setForm(EMPTY_CHECKIN); onSaved(); }
    catch (requestError) { setError(requestError.response?.data?.detail || "The check-in could not be saved."); }
    finally { setSaving(false); }
  };
  return <section className="rounded-[1.75rem] border border-[#c9d0d3] bg-[#f4f1ea] p-6 shadow-[0_14px_40px_rgba(37,42,46,.08)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#59646a]">Monthly check-in</p><h2 className="mt-3 text-3xl font-black tracking-[-.055em]">How is the vehicle feeling?</h2><p className="mt-2 text-sm leading-6 text-[#59646a]">A short monthly entry makes the next service conversation more useful.</p><form onSubmit={submit} className="mt-6 space-y-4" noValidate>
    {error ? <div ref={formRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div> : null}
    <label className="block"><span className="text-sm font-bold">Current odometer reading <span className="text-[#59646a]">(miles)</span></span><input required min="0" inputMode="numeric" type="number" value={form.odometer_miles} onChange={(event) => setForm({ ...form, odometer_miles: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-[#aeb8bc] bg-white px-4 text-base outline-none transition focus:border-[#252a2e] focus:ring-4 focus:ring-[#c9d0d3]" placeholder="e.g. 28,450" /></label>
    <label className="block"><span className="text-sm font-bold">Issues noticed this month <span className="font-normal text-[#59646a]">(optional)</span></span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-[#aeb8bc] bg-white px-4 py-3 text-base outline-none transition focus:border-[#252a2e] focus:ring-4 focus:ring-[#c9d0d3]" placeholder="For example, a rattle near the left wheel or slower starting in the morning." /></label>
    <button disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3b454c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#252a2e] disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />} {saving ? "Saving check-in..." : "Save monthly check-in"}</button>
  </form></section>;
}

function ServiceRecordModal({ vehicleId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyServiceRecord); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const errorRef = useRef(null);
  const setItem = (index, value) => setForm((current) => ({ ...current, completed_items: current.completed_items.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const submit = async (event) => { event.preventDefault(); setError(""); const items = form.completed_items.map((item) => item.trim()).filter(Boolean); if (!items.length) { setError("Add at least one completed work item."); errorRef.current?.focus(); return; } if (!form.odometer_miles || !form.provider_name.trim()) { setError("Enter the service mileage and provider name."); errorRef.current?.focus(); return; } setSaving(true); try { const data = new FormData(); Object.entries({ service_date: form.service_date, odometer_miles: form.odometer_miles, provider_name: form.provider_name, completed_items: JSON.stringify(items), total_cost: form.total_cost || 0, notes: form.notes, next_due_date: form.next_due_date, next_due_miles: form.next_due_miles }).forEach(([key, value]) => { if (value !== "" && value !== null) data.append(key, value); }); if (form.invoice) data.append("invoice", form.invoice); await addServiceRecord(vehicleId, data); onSaved(); } catch (requestError) { setError(requestError.response?.data?.detail || "The service record could not be saved."); errorRef.current?.focus(); } finally { setSaving(false); } };
  return <div role="dialog" aria-modal="true" aria-labelledby="service-record-title" className="fixed inset-0 z-50 overflow-y-auto bg-[#252a2e]/65 px-4 py-6 backdrop-blur-sm"><div className="mx-auto w-full max-w-3xl rounded-[2rem] bg-[#f4f1ea] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#59646a]">Vehicle Care</p><h2 id="service-record-title" className="mt-2 text-3xl font-black tracking-[-.055em]">Add service record</h2></div><button aria-label="Close service record form" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#c9d0d3] text-[#59646a] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b454c]"><X size={18} /></button></div><form onSubmit={submit} className="mt-7 space-y-5" noValidate>
    {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Service date"><input required type="date" value={form.service_date} onChange={(event) => setForm({ ...form, service_date: event.target.value })} /></Field><Field label="Odometer reading (miles)"><input required min="0" type="number" value={form.odometer_miles} onChange={(event) => setForm({ ...form, odometer_miles: event.target.value })} placeholder="e.g. 28,450" /></Field><Field label="Provider or workshop"><input required type="text" value={form.provider_name} onChange={(event) => setForm({ ...form, provider_name: event.target.value })} placeholder="e.g. Reed Auto Works" /></Field><Field label="Total service cost"><input min="0" step="0.01" type="number" value={form.total_cost} onChange={(event) => setForm({ ...form, total_cost: event.target.value })} placeholder="0.00" /></Field></div>
    <fieldset><legend className="text-sm font-bold">Completed work</legend><p className="mt-1 text-sm text-[#59646a]">Add every item completed during this service.</p><div className="mt-3 space-y-2">{form.completed_items.map((item, index) => <div key={index} className="flex gap-2"><input aria-label={`Completed work item ${index + 1}`} value={item} onChange={(event) => setItem(index, event.target.value)} className="min-h-11 flex-1 rounded-xl border border-[#aeb8bc] bg-white px-4 outline-none focus:border-[#252a2e] focus:ring-4 focus:ring-[#c9d0d3]" placeholder="e.g. Oil and filter change" />{form.completed_items.length > 1 ? <button type="button" aria-label={`Remove completed work item ${index + 1}`} onClick={() => setForm({ ...form, completed_items: form.completed_items.filter((_, itemIndex) => itemIndex !== index) })} className="min-h-11 min-w-11 rounded-xl border border-[#c9d0d3] text-[#59646a] hover:bg-white"><X size={17} /></button> : null}</div>)}</div><button type="button" onClick={() => setForm({ ...form, completed_items: [...form.completed_items, ""] })} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#3b454c] underline decoration-[#aeb8bc] decoration-2 underline-offset-4"><Plus size={16} /> Add another item</button></fieldset>
    <label className="block"><span className="text-sm font-bold">Notes <span className="font-normal text-[#59646a]">(optional)</span></span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 w-full rounded-xl border border-[#aeb8bc] bg-white px-4 py-3 outline-none focus:border-[#252a2e] focus:ring-4 focus:ring-[#c9d0d3]" placeholder="Anything useful to remember about this service." /></label>
    <label className="block"><span className="text-sm font-bold">Invoice <span className="font-normal text-[#59646a]">(one PDF, JPG, or PNG, up to 10 MB)</span></span><span className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#aeb8bc] bg-white px-4 text-sm text-[#59646a] transition hover:border-[#59646a]"><Upload size={18} aria-hidden="true" /><span className="truncate">{form.invoice?.name || "Choose an invoice file"}</span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setForm({ ...form, invoice: event.target.files?.[0] || null })} className="sr-only" /></span></label>
    <fieldset className="rounded-2xl border border-[#c9d0d3] p-4"><legend className="px-2 text-sm font-bold">Next service target <span className="font-normal text-[#59646a]">(optional)</span></legend><div className="grid gap-4 sm:grid-cols-2"><Field label="Due date"><input type="date" value={form.next_due_date} onChange={(event) => setForm({ ...form, next_due_date: event.target.value })} /></Field><Field label="Due mileage"><input min="0" type="number" value={form.next_due_miles} onChange={(event) => setForm({ ...form, next_due_miles: event.target.value })} placeholder="e.g. 35,000" /></Field></div><p className="mt-3 text-xs leading-5 text-[#59646a]">Wingman will flag service as due when either target occurs first.</p></fieldset>
    <div className="flex flex-col-reverse gap-3 border-t border-[#c9d0d3] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-[#aeb8bc] px-5 text-sm font-bold text-[#59646a] hover:bg-white">Cancel</button><button disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#3b454c] px-5 text-sm font-bold text-white hover:bg-[#252a2e] disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}{saving ? "Saving service..." : "Save service record"}</button></div>
  </form></div></div>;
}

function Field({ label, children }) { return <label className="block"><span className="text-sm font-bold">{label}</span>{typeof children === "object" ? <span className="mt-2 block [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#aeb8bc] [&_input]:bg-white [&_input]:px-4 [&_input]:outline-none [&_input]:focus:border-[#252a2e] [&_input]:focus:ring-4 [&_input]:focus:ring-[#c9d0d3]">{children}</span> : children}</label>; }

function HistorySection({ checkins, records, onDownload }) {
  const timeline = useMemo(() => [...records.map((item) => ({ ...item, type: "service", date: item.service_date })), ...checkins.map((item) => ({ ...item, type: "checkin", date: item.recorded_on }))].sort((a, b) => new Date(b.date) - new Date(a.date)), [checkins, records]);
  return <section className="mt-8 border-t border-[#c9d0d3] pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#59646a]">Vehicle timeline</p><h2 className="mt-2 text-3xl font-black tracking-[-.055em]">Every note stays with this vehicle.</h2></div><span className="text-sm text-[#59646a]">Newest first</span></div>{timeline.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-[#aeb8bc] bg-[#f4f1ea] p-8 text-center"><HeartPulse className="mx-auto text-[#59646a]" size={28} /><p className="mt-3 font-bold">No Vehicle Care entries yet</p><p className="mt-1 text-sm text-[#59646a]">Your monthly check-ins and completed services will appear here.</p></div> : <div className="mt-6 grid gap-3">{timeline.map((entry) => entry.type === "service" ? <article key={`service-${entry.id}`} className="rounded-3xl border border-[#aeb8bc] bg-[#f4f1ea] p-5 shadow-[0_10px_28px_rgba(37,42,46,.06)]"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3b454c] text-white"><Wrench size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#59646a]">Completed service · {formatDate(entry.service_date)}</p><h3 className="mt-1 text-lg font-black">{entry.provider_name}</h3><p className="mt-1 text-sm text-[#59646a]">{formatNumber(entry.odometer_miles)} · ${Number(entry.total_cost).toFixed(2)}</p></div></div>{entry.invoice_filename ? <button onClick={() => onDownload(entry)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#aeb8bc] bg-white px-3 text-sm font-bold text-[#3b454c] hover:bg-[#e1e4e3]"><FileText size={16} /> Open invoice</button> : null}</div><div className="mt-4 flex flex-wrap gap-2">{entry.completed_items.map((item) => <span key={item} className="rounded-full bg-[#e1e4e3] px-3 py-1.5 text-xs font-bold text-[#3b454c]">{item}</span>)}</div>{entry.notes ? <p className="mt-4 border-t border-[#d7dcdd] pt-4 text-sm leading-6 text-[#59646a]">{entry.notes}</p> : null}{entry.next_due_date || entry.next_due_miles ? <p className="mt-4 text-xs font-bold uppercase tracking-[.12em] text-[#59646a]">Next target: {entry.next_due_date ? formatDate(entry.next_due_date) : ""}{entry.next_due_date && entry.next_due_miles ? " · " : ""}{entry.next_due_miles ? formatNumber(entry.next_due_miles) : ""}</p> : null}</article> : <article key={`checkin-${entry.id}`} className="rounded-3xl border border-[#d7dcdd] bg-white/65 p-5"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e1e4e3] text-[#3b454c]"><Gauge size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#59646a]">Monthly check-in · {formatDate(entry.recorded_on)}</p><p className="mt-1 text-lg font-black">{formatNumber(entry.odometer_miles)}</p>{entry.note ? <p className="mt-2 text-sm leading-6 text-[#59646a]">{entry.note}</p> : <p className="mt-2 text-sm text-[#59646a]">No issues noted.</p>}</div></div></article>)}</div>}</section>;
}

function LoadingState() { return <main className="flex min-h-[70vh] items-center justify-center bg-[#e8e6df]"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#3b454c]" size={28} /><p className="mt-3 text-sm font-semibold text-[#59646a]">Loading Vehicle Care...</p></div></main>; }
function ErrorState({ message, onRetry }) { return <main className="flex min-h-[70vh] items-center justify-center bg-[#e8e6df] p-6"><div role="alert" className="max-w-md rounded-3xl border border-red-200 bg-[#f4f1ea] p-7 text-center shadow-xl"><CircleAlert className="mx-auto text-red-600" size={28} /><h1 className="mt-4 text-xl font-black">Vehicle Care is unavailable</h1><p className="mt-2 text-sm leading-6 text-[#59646a]">{message}</p><button onClick={onRetry} className="mt-5 min-h-11 rounded-xl bg-[#3b454c] px-4 text-sm font-bold text-white">Try again</button></div></main>; }
