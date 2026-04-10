import { useState, useEffect } from "react";
import { getMyVehicles, addVehicle, deleteVehicle } from "../api/endpoints";
import { Card, Spinner, EmptyState } from "../components/UI";
import { Plus, Trash2, Car, X } from "lucide-react";

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
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">My Vehicles</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-brand-700"
        >
          <Plus size={15} /> Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="No vehicles yet" subtitle="Add a vehicle to request roadside assistance" />
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <Card key={v.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
                  <Car size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{v.year} {v.make} {v.model}</p>
                  <p className="text-xs text-gray-500">{v.license_plate} · <span className="capitalize">{v.vehicle_type}</span></p>
                </div>
              </div>
              <button onClick={() => handleDelete(v.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddVehicleModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
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
