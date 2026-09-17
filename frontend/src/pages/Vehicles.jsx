import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyVehicles, addVehicle, deleteVehicle, addVehicleQuickNote, getVehicleQuickNotes } from "../api/endpoints";
import { Card, Spinner, EmptyState } from "../components/UI";
import { Plus, Trash2, Car, X, HeartPulse, NotebookPen } from "lucide-react";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);

  useEffect(() => {
    getMyVehicles().then((r) => setVehicles(r.data)).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Remove this vehicle?")) return;
    await deleteVehicle(id);
    setVehicles((v) => v.filter((x) => x.id !== id));
  };

  const handleAdd = async (form) => {
    const res = await addVehicle(form);
    setVehicles((v) => [...v, res.data]);
    setShowAdd(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-[#252a2e]">
      <div className="flex items-center justify-between mb-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#59646a]">Owner workspace</p><h1 className="mt-1 text-3xl font-black tracking-[-.055em]">Your vehicles</h1></div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#252a2e] px-4 text-sm font-bold text-[#f4f1ea] transition hover:bg-[#3b454c]"
        >
          <Plus size={15} /> Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="No vehicles yet" subtitle="Add a vehicle to request roadside assistance" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vehicles.map((v) => (
            <Card key={v.id} className="rounded-3xl border-[#c9d0d3] p-5">
              <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
                  <Car size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{v.year} {v.make} {v.model}</p>
                  <p className="text-xs text-gray-500">{v.license_plate} · <span className="capitalize">{v.vehicle_type}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/vehicles/${v.id}/care`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <HeartPulse size={15} aria-hidden="true" /> Vehicle Care
                </Link>
                <button aria-label={`Remove ${v.year} ${v.make} ${v.model}`} onClick={() => handleDelete(v.id)} className="min-h-10 min-w-10 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
              </div>
              {v.notes ? <p className="mt-4 border-t border-[#d7dcdd] pt-4 text-sm leading-6 text-[#59646a]">{v.notes}</p> : null}
              <QuickNotes vehicleId={v.id} />
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddVehicleModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function QuickNotes({ vehicleId }) {
  const [notes, setNotes] = useState([]);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) getVehicleQuickNotes(vehicleId).then((r) => setNotes(r.data)).catch(() => setNotes([])); }, [open, vehicleId]);
  const save = async (event) => {
    event.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    try { const response = await addVehicleQuickNote(vehicleId, { note: value.trim() }); setNotes((current) => [response.data, ...current]); setValue(""); }
    finally { setSaving(false); }
  };
  return <section className="mt-5 border-t border-[#d7dcdd] pt-4"><button onClick={() => setOpen((current) => !current)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#3b454c]"><NotebookPen size={16} /> {open ? "Hide quick notes" : "Add a quick note"}</button>{open ? <div className="mt-3"><form onSubmit={save} className="flex gap-2"><input value={value} onChange={(event) => setValue(event.target.value)} maxLength={2000} placeholder="Something to remember about this vehicle" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#c9d0d3] bg-white px-3 text-sm outline-none focus:border-[#3b454c]" /><button disabled={saving} className="min-h-11 rounded-xl bg-[#3b454c] px-3 text-sm font-bold text-white disabled:opacity-60">Save</button></form>{notes.length ? <div className="mt-3 space-y-2">{notes.slice(0, 3).map((note) => <p className="rounded-xl bg-[#e8e6df] px-3 py-2 text-sm text-[#3b454c]" key={note.id}>{note.note}</p>)}</div> : <p className="mt-3 text-sm text-[#59646a]">No quick notes yet.</p>}</div> : null}</section>;
}

function AddVehicleModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ make: "", model: "", year: 2020, license_plate: "", vehicle_type: "car" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try { await onAdd(form); }
    catch (err) { setError(err.response?.data?.detail || "Failed to add vehicle"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add Vehicle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: "make",  label: "Make",  type: "text",   placeholder: "Toyota" },
            { key: "model", label: "Model", type: "text",   placeholder: "Innova" },
            { key: "year",  label: "Year",  type: "number", placeholder: "2020"   },
            { key: "license_plate", label: "License Plate", type: "text", placeholder: "TS09AB1234" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type} required placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {["car", "bike", "suv", "truck", "other"].map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
              {loading ? "Adding..." : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
