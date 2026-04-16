import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Check, PackagePlus, Pencil, Trash2, X } from "lucide-react";

import { getMechanicParts, addPart, updatePart, deletePart, getMyMechanicProfile } from "../api/endpoints";
import { Card, Spinner, EmptyState } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

export default function Inventory() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadInventory = async () => {
    setLoading(true);
    try {
      const profileRes = await getMyMechanicProfile();
      const partsRes = await getMechanicParts(profileRes.data.mechanic_id);
      setParts(partsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const lowStock = useMemo(() => parts.filter((part) => Number(part.quantity) < 4), [parts]);
  const outOfStock = useMemo(() => parts.filter((part) => Number(part.quantity) === 0), [parts]);
  const totalValue = useMemo(
    () => parts.reduce((sum, part) => sum + Number(part.price || 0) * Number(part.quantity || 0), 0),
    [parts]
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this part from inventory?")) return;
    await deletePart(id);
    setParts((current) => current.filter((item) => item.id !== id));
  };

  const handleEditSave = async (id) => {
    const res = await updatePart(id, editForm);
    setParts((current) => current.map((item) => (item.id === id ? res.data : item)));
    setEditId(null);
    setEditForm({});
  };

  const handleAdd = async (form) => {
    const res = await addPart(form);
    setParts((current) => [res.data, ...current]);
    setShowAdd(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Inventory operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Parts register and stock health</h1>
            <p className="mt-2 text-sm text-slate-500">Track stock, restock low-count items, and keep every part ready for incoming roadside calls.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            <PackagePlus size={16} />
            Add part
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InventoryStat label="Tracked parts" value={parts.length} tone="blue" />
          <InventoryStat label="Low stock" value={lowStock.length} tone="amber" />
          <InventoryStat label="Out of stock" value={outOfStock.length} tone="red" />
          <InventoryStat label="Inventory value" value={formatCurrencyUSD(totalValue)} tone="slate" />
        </div>

        {lowStock.length > 0 ? (
          <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Restock recommended</p>
              <p className="mt-1 text-sm text-amber-800">
                {lowStock.length} part(s) have fewer than 4 units: {lowStock.slice(0, 6).map((p) => p.part_name).join(", ")}
              </p>
            </div>
          </div>
        ) : null}

        {parts.length === 0 ? (
          <EmptyState icon="📦" title="No parts yet" subtitle="Add your first part to get started." />
        ) : (
          <Card className="overflow-hidden rounded-[30px] border border-[#dbe7ff] bg-white shadow-lg">
            <div className="grid grid-cols-[1.7fr,1fr,0.8fr,0.8fr,1fr,1fr] gap-3 border-b border-[#e8eefc] bg-[#f8fbff] px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <div>Part</div>
              <div>Part no.</div>
              <div>Qty</div>
              <div>Min</div>
              <div>Price</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="max-h-[38rem] overflow-y-auto">
              {parts.map((part) => (
                <div key={part.id} className="grid grid-cols-[1.7fr,1fr,0.8fr,0.8fr,1fr,1fr] gap-3 border-b border-[#eef2ff] px-5 py-4 text-sm text-[#081224]">
                  {editId === part.id ? (
                    <>
                      <input className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 outline-none" value={editForm.part_name ?? part.part_name} onChange={(e) => setEditForm({ ...editForm, part_name: e.target.value })} />
                      <div className="flex items-center text-slate-400">{part.part_number || "—"}</div>
                      <input type="number" min="0" className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 outline-none" value={editForm.quantity ?? part.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })} />
                      <input type="number" min="0" className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 outline-none" value={editForm.min_threshold ?? part.min_threshold} onChange={(e) => setEditForm({ ...editForm, min_threshold: Number(e.target.value) })} />
                      <input type="number" min="0" step="0.01" className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 outline-none" value={editForm.price ?? part.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} />
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditSave(part.id)} className="rounded-full border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                        <button onClick={() => { setEditId(null); setEditForm({}); }} className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><X size={15} /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-semibold">{part.part_name}</p>
                        {part.is_low_stock ? <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">low stock</span> : null}
                      </div>
                      <div className="flex items-center text-slate-500">{part.part_number || "—"}</div>
                      <div className={`flex items-center font-semibold ${Number(part.quantity) === 0 ? "text-red-600" : Number(part.quantity) < 4 ? "text-amber-600" : "text-[#081224]"}`}>{part.quantity}</div>
                      <div className="flex items-center text-slate-500">{part.min_threshold}</div>
                      <div className="flex items-center font-semibold">{formatCurrencyUSD(part.price)}</div>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditId(part.id); setEditForm({}); }} className="rounded-full border border-[#dbe7ff] p-2 text-[#2563eb] hover:bg-[#f8fbff]"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(part.id)} className="rounded-full border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showAdd ? <AddPartModal onAdd={handleAdd} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}

function InventoryStat({ label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff]",
    amber: "bg-[#fff7ed]",
    red: "bg-[#fef2f2]",
    slate: "bg-[#f8fafc]",
  };
  return (
    <div className={`rounded-[24px] border border-[#dbe7ff] px-4 py-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
    </div>
  );
}

function AddPartModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    part_name: "",
    part_number: "",
    quantity: 0,
    min_threshold: 2,
    price: 0,
    compatible_vehicles: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
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

  return (
    <div className="fixed inset-0 z-[750] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Inventory</p>
            <h3 className="mt-1 text-xl font-semibold text-[#081224]">Add a new part</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Part name" value={form.part_name} onChange={(value) => setForm((current) => ({ ...current, part_name: value }))} />
            <Input label="Part number" value={form.part_number} onChange={(value) => setForm((current) => ({ ...current, part_number: value }))} />
            <Input label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm((current) => ({ ...current, quantity: Number(value) }))} />
            <Input label="Min threshold" type="number" value={form.min_threshold} onChange={(value) => setForm((current) => ({ ...current, min_threshold: Number(value) }))} />
            <Input label="Price ($)" type="number" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))} />
          </div>
          {error ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Adding..." : "Add part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={label.includes("Price") ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 text-sm text-[#081224] outline-none"
      />
    </label>
  );
}
