import { useState, useEffect } from "react";
import { getMechanicParts, addPart, updatePart, deletePart, getMyMechanicProfile } from "../api/endpoints";
import { Card, Spinner, EmptyState } from "../components/UI";
import { Plus, Pencil, Trash2, AlertTriangle, X, Check } from "lucide-react";
import { formatCurrencyUSD } from "../lib/formatters";

export default function Inventory() {
  const [parts, setParts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await getMyMechanicProfile();
        const partsRes = await getMechanicParts(profileRes.data.mechanic_id);
        setParts(partsRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Remove this part from inventory?")) return;
    await deletePart(id);
    setParts((p) => p.filter((x) => x.id !== id));
  };

  const handleEditSave = async (id) => {
    const res = await updatePart(id, editForm);
    setParts((p) => p.map((x) => x.id === id ? res.data : x));
    setEditId(null);
    setEditForm({});
  };

  const handleAdd = async (form) => {
    const res = await addPart(form);
    setParts((p) => [...p, res.data]);
    setShowAdd(false);
  };

  if (loading) return <Spinner />;

  const lowStock = parts.filter((p) => p.is_low_stock);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Spare Parts Inventory</h1>
          <p className="text-sm text-gray-500">{parts.length} parts · {lowStock.length} low stock</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-brand-700"
        >
          <Plus size={15} /> Add Part
        </button>
      </div>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{lowStock.length} part(s)</strong> are below minimum stock threshold:{" "}
            {lowStock.map((p) => p.part_name).join(", ")}
          </p>
        </div>
      )}

      {parts.length === 0 ? (
        <EmptyState icon="📦" title="No parts yet" subtitle="Add your first part to get started" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Part Name", "Part No.", "Qty", "Min", "Price ($)", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parts.map((part) => (
                <tr key={part.id} className={`hover:bg-gray-50 ${part.is_low_stock ? "bg-amber-50/40" : ""}`}>
                  {editId === part.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editForm.part_name ?? part.part_name}
                          onChange={(e) => setEditForm({ ...editForm, part_name: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{part.part_number || "—"}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number" min="0"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editForm.quantity ?? part.quantity}
                          onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number" min="0"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editForm.min_threshold ?? part.min_threshold}
                          onChange={(e) => setEditForm({ ...editForm, min_threshold: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number" min="0" step="0.01"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editForm.price ?? part.price}
                          onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleEditSave(part.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setEditId(null); setEditForm({}); }}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {part.part_name}
                        {part.is_low_stock && (
                          <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">low</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{part.part_number || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${part.quantity === 0 ? "text-red-600" : part.is_low_stock ? "text-amber-600" : "text-gray-800"}`}>
                          {part.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{part.min_threshold}</td>
                      <td className="px-4 py-2.5 text-gray-800">{formatCurrencyUSD(part.price)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditId(part.id); setEditForm({}); }}
                            className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(part.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showAdd && <AddPartModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddPartModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    part_name: "", part_number: "", quantity: 0,
    min_threshold: 2, price: 0, compatible_vehicles: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onAdd(form);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add part");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "part_name",      label: "Part Name",       type: "text",   required: true  },
    { key: "part_number",    label: "Part Number",     type: "text",   required: false },
    { key: "quantity",       label: "Quantity",         type: "number", required: true  },
    { key: "min_threshold",  label: "Min Threshold",   type: "number", required: true  },
    { key: "price",          label: "Price ($)",       type: "number", required: true  },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add New Part</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                min={type === "number" ? 0 : undefined}
                step={key === "price" ? "0.01" : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
              {loading ? "Adding..." : "Add Part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
