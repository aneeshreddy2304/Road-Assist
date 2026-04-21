import { useEffect, useMemo, useState } from "react";
import {
  Check,
  MessagesSquare,
  PackagePlus,
  Pencil,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";

import {
  addWarehousePart,
  deleteWarehouseThread,
  getMyWarehouseProfile,
  getWarehouseInbox,
  getWarehouseInventory,
  getWarehouseOrderDetail,
  getWarehouseOrders,
  getWarehouseThread,
  sendWarehouseMessage,
  updateWarehouseOrderGroup,
  updateWarehousePart,
} from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const tabs = [
  { id: "overview", label: "Overview", icon: <Store size={16} /> },
  { id: "inventory", label: "Inventory", icon: <PackagePlus size={16} /> },
  { id: "orders", label: "Orders", icon: <ShoppingCart size={16} /> },
  { id: "messages", label: "Messages", icon: <MessagesSquare size={16} /> },
];

export default function Warehouse() {
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrderRef, setSelectedOrderRef] = useState(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [conversationDeleting, setConversationDeleting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [profileRes, inventoryRes, ordersRes, inboxRes] = await Promise.all([
        getMyWarehouseProfile(),
        getWarehouseInventory(),
        getWarehouseOrders(),
        getWarehouseInbox(),
      ]);
      setProfile(profileRes.data);
      setInventory(inventoryRes.data);
      setOrders(ordersRes.data);
      setSelectedOrderRef((current) => {
        if (!ordersRes.data?.length) return null;
        if (!current) return ordersRes.data[0].order_ref;
        return ordersRes.data.find((item) => item.order_ref === current)?.order_ref || ordersRes.data[0].order_ref;
      });
      setInbox(inboxRes.data);
      if (!selectedConversation && inboxRes.data.length) {
        setSelectedConversation(inboxRes.data[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    setInventoryLoading(true);
    try {
      const res = await getWarehouseInventory();
      setInventory(res.data);
    } finally {
      setInventoryLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await getWarehouseOrders();
      setOrders(res.data);
      setSelectedOrderRef((current) => {
        if (!res.data?.length) return null;
        if (!current) return res.data[0].order_ref;
        return res.data.find((item) => item.order_ref === current)?.order_ref || res.data[0].order_ref;
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadOrderDetail = async (orderRef = selectedOrderRef, { background = false } = {}) => {
    if (!orderRef) {
      setSelectedOrderDetail(null);
      return;
    }
    if (!background) {
      setOrderDetailLoading(true);
    }
    try {
      const res = await getWarehouseOrderDetail(orderRef);
      setSelectedOrderDetail(res.data);
    } finally {
      if (!background) {
        setOrderDetailLoading(false);
      }
    }
  };

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const res = await getWarehouseInbox();
      setInbox(res.data);
      setSelectedConversation((current) => {
        if (!res.data?.length) return null;
        if (!current) return res.data[0];
        return (
          res.data.find(
            (item) =>
              item.warehouse_id === current.warehouse_id &&
              item.mechanic_id === current.mechanic_id
          ) || res.data[0]
        );
      });
    } finally {
      setInboxLoading(false);
    }
  };

  const loadThread = async (mechanicId = selectedConversation?.mechanic_id, { background = false } = {}) => {
    if (!mechanicId) {
      setThreadMessages([]);
      setThreadError("");
      return;
    }
    if (!background) {
      setThreadLoading(true);
      setThreadError("");
    }
    try {
      const res = await getWarehouseThread({ mechanic_id: mechanicId });
      setThreadMessages(res.data);
    } catch (err) {
      setThreadMessages([]);
      setThreadError(err.response?.data?.detail || "Could not load conversation");
    } finally {
      if (!background) {
        setThreadLoading(false);
      }
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!selectedConversation?.mechanic_id) return;
    loadThread(selectedConversation.mechanic_id);
    const timer = window.setInterval(() => loadThread(selectedConversation.mechanic_id, { background: true }), 4000);
    return () => window.clearInterval(timer);
  }, [selectedConversation?.mechanic_id]);

  useEffect(() => {
    if (!selectedOrderRef) {
      setSelectedOrderDetail(null);
      return;
    }
    loadOrderDetail(selectedOrderRef);
  }, [selectedOrderRef]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadOrders();
      loadInbox();
      loadInventory();
      if (selectedOrderRef) {
        loadOrderDetail(selectedOrderRef, { background: true });
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedOrderRef]);

  const lowStock = useMemo(() => inventory.filter((part) => Number(part.quantity) <= Number(part.min_threshold)), [inventory]);
  const totalValue = useMemo(
    () => inventory.reduce((sum, part) => sum + Number(part.price || 0) * Number(part.quantity || 0), 0),
    [inventory]
  );
  const activeOrders = useMemo(() => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)), [orders]);

  const handleAddPart = async (payload) => {
    await addWarehousePart(payload);
    setShowAdd(false);
    loadInventory();
    const res = await getMyWarehouseProfile();
    setProfile(res.data);
  };

  const handleEditSave = async (partId) => {
    await updateWarehousePart(partId, editForm);
    setEditId(null);
    setEditForm({});
    loadInventory();
  };

  const handleOrderUpdate = async (orderRef, next) => {
    await updateWarehouseOrderGroup(orderRef, next);
    await Promise.all([loadOrders(), loadOrderDetail(orderRef), loadInventory()]);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation?.mechanic_id || !messageDraft.trim()) return;
    setMessageSending(true);
    setThreadError("");
    try {
      await sendWarehouseMessage({
        mechanic_id: selectedConversation.mechanic_id,
        warehouse_order_id: selectedConversation.warehouse_order_id || null,
        message: messageDraft.trim(),
      });
      setMessageDraft("");
      await Promise.all([loadThread(selectedConversation.mechanic_id), loadInbox()]);
    } catch (err) {
      setThreadError(err.response?.data?.detail || "Could not send message");
    } finally {
      setMessageSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation?.mechanic_id || conversationDeleting) return;
    const confirmed = window.confirm(`Delete this mechanic chat with ${selectedConversation.mechanic_name || "this mechanic"}?`);
    if (!confirmed) return;

    setConversationDeleting(true);
    setThreadError("");
    try {
      await deleteWarehouseThread({ mechanic_id: selectedConversation.mechanic_id });
      const currentMechanicId = selectedConversation.mechanic_id;
      setInbox((current) => current.filter((item) => item.mechanic_id !== currentMechanicId));
      setSelectedConversation((current) => (current?.mechanic_id === currentMechanicId ? null : current));
      setThreadMessages([]);
      setMessageDraft("");
      await loadInbox();
    } catch (err) {
      setThreadError(err.response?.data?.detail || "Could not delete this conversation");
    } finally {
      setConversationDeleting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <div className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Warehouse workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">{profile?.name}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Manage supplier inventory, respond to incoming mechanic sourcing requests, update order status, and keep procurement conversations moving in one place.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:w-[28rem]">
              <MetricTile label="Active parts" value={profile?.available_parts || 0} tone="blue" />
              <MetricTile label="Open orders" value={activeOrders.length} tone="amber" />
              <MetricTile label="Low stock parts" value={profile?.low_stock_parts || 0} tone="red" />
              <MetricTile label="Inventory value" value={formatCurrencyUSD(totalValue)} tone="emerald" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-full border border-[#dbe7ff] bg-white p-2 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === item.id ? "bg-[#0f172a] text-white" : "text-slate-600 hover:bg-[#f8fbff]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Supplier profile</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{profile?.name}</h2>
              <p className="mt-3 text-sm text-slate-500">{profile?.description}</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <InfoRow label="Address" value={profile?.address} />
                <InfoRow label="Contact" value={profile?.contact_phone} />
                <InfoRow label="Fulfillment" value={profile?.fulfillment_hours} />
                <InfoRow label="Coordinates" value={`${profile?.lat}, ${profile?.lng}`} />
              </div>
            </Card>

            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incoming momentum</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryPanel label="Pending quotes" value={orders.filter((item) => item.status === "requested").length} />
                <SummaryPanel label="Quoted / confirmed" value={orders.filter((item) => ["quoted", "confirmed"].includes(item.status)).length} />
                <SummaryPanel label="Packed" value={orders.filter((item) => item.status === "packed").length} />
                <SummaryPanel label="Delivered" value={orders.filter((item) => item.status === "delivered").length} />
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "inventory" ? (
          <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Warehouse inventory</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{inventory.length} supplier parts</h2>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                <PackagePlus size={16} />
                Add inventory item
              </button>
            </div>

            {lowStock.length > 0 ? (
              <p className="mt-4 rounded-[24px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {lowStock.length} part(s) are at or below threshold. Replenish these before mechanics start seeing quote delays.
              </p>
            ) : null}

            {inventoryLoading ? <Spinner /> : null}
            {!inventoryLoading && inventory.length === 0 ? (
              <EmptyState icon="📦" title="No warehouse inventory yet" subtitle="Add your first stocked part to start serving mechanics." />
            ) : null}
            {!inventoryLoading && inventory.length > 0 ? (
              <div className="mt-5 space-y-3">
                {inventory.map((part) => (
                  <div key={part.id} className="rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                    {editId === part.id ? (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Part name" value={editForm.part_name ?? part.part_name} onChange={(value) => setEditForm((current) => ({ ...current, part_name: value }))} />
                        <Field label="Part number" value={editForm.part_number ?? part.part_number ?? ""} onChange={(value) => setEditForm((current) => ({ ...current, part_number: value }))} />
                        <Field label="Quantity" type="number" value={editForm.quantity ?? part.quantity} onChange={(value) => setEditForm((current) => ({ ...current, quantity: Number(value) }))} />
                        <Field label="Min threshold" type="number" value={editForm.min_threshold ?? part.min_threshold} onChange={(value) => setEditForm((current) => ({ ...current, min_threshold: Number(value) }))} />
                        <Field label="Price" type="number" value={editForm.price ?? part.price} onChange={(value) => setEditForm((current) => ({ ...current, price: Number(value) }))} />
                        <Field label="Lead time" value={editForm.lead_time_label ?? part.lead_time_label ?? ""} onChange={(value) => setEditForm((current) => ({ ...current, lead_time_label: value }))} />
                        <div className="md:col-span-2 xl:col-span-3 flex justify-end gap-2">
                          <button onClick={() => handleEditSave(part.id)} className="rounded-full border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                          <button onClick={() => { setEditId(null); setEditForm({}); }} className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><X size={15} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-[#081224]">{part.part_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{part.part_number || "No part number"} · {part.manufacturer || "Generic supply"}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{part.lead_time_label || "Pickup timing on request"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[#081224]">{formatCurrencyUSD(part.price)}</p>
                          <p className={`mt-1 text-sm font-medium ${part.is_low_stock ? "text-amber-600" : "text-slate-500"}`}>
                            {part.quantity} units · threshold {part.min_threshold}
                          </p>
                          <button
                            onClick={() => { setEditId(part.id); setEditForm({}); }}
                            className="mt-3 rounded-full border border-[#dbe7ff] p-2 text-[#2563eb] hover:bg-white"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {tab === "orders" ? (
          <div className="grid gap-4 xl:grid-cols-[0.82fr,1.18fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incoming mechanic orders</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{orders.length} supplier orders</h2>
                </div>
                {ordersLoading ? <Spinner /> : null}
              </div>

              {orders.length === 0 ? (
                <EmptyState icon="🧾" title="No mechanic orders yet" subtitle="Orders placed by mechanics will appear here with status and pricing controls." />
              ) : (
                <div className="mt-5 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                  {orders.map((order) => (
                    <button
                      key={order.order_ref}
                      onClick={() => setSelectedOrderRef(order.order_ref)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selectedOrderRef === order.order_ref
                          ? "border-[#2563eb] bg-[#f8fbff]"
                          : "border-[#dbe7ff] bg-white hover:bg-[#fbfdff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563eb]">{order.order_ref}</p>
                          <p className="mt-2 text-lg font-semibold text-[#081224]">{order.mechanic_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{order.line_count} lines · {order.total_quantity} units</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{order.status.replaceAll("_", " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[#081224]">{formatCurrencyUSD(order.total_price || 0)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              {orderDetailLoading ? (
                <Spinner />
              ) : selectedOrderDetail ? (
                <WarehouseOrderGroupDetail
                  order={selectedOrderDetail}
                  onUpdate={handleOrderUpdate}
                  onOpenThread={() => {
                    setSelectedConversation({
                      warehouse_id: selectedOrderDetail.warehouse_id,
                      warehouse_name: selectedOrderDetail.warehouse_name,
                      mechanic_id: selectedOrderDetail.mechanic_id,
                      mechanic_name: selectedOrderDetail.mechanic_name,
                    });
                    setTab("messages");
                  }}
                />
              ) : (
                <EmptyState icon="🧾" title="Choose an order" subtitle="Select an incoming mechanic order to review items, accept it, and advance shipping status." />
              )}
            </Card>
          </div>
        ) : null}

        {tab === "messages" ? (
          <div className="grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mechanic inbox</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{inbox.length} active chats</h2>
                </div>
                {inboxLoading ? <Spinner /> : null}
              </div>
              <div className="mt-5 space-y-3">
                {inbox.length === 0 ? (
                  <EmptyState icon="💬" title="No mechanic messages yet" subtitle="A conversation starts automatically once a mechanic orders or reaches out." />
                ) : (
                  inbox.map((thread) => (
                    <button
                      key={`${thread.warehouse_id}-${thread.mechanic_id}`}
                      onClick={() => setSelectedConversation(thread)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selectedConversation?.mechanic_id === thread.mechanic_id
                          ? "border-[#2563eb] bg-[#f8fbff]"
                          : "border-[#dbe7ff] bg-white hover:bg-[#fbfdff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#081224]">{thread.mechanic_name}</p>
                          <p className="mt-1 text-sm text-slate-500 line-clamp-2">{thread.latest_message}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                          {new Date(thread.latest_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <ConversationSurface
              title={selectedConversation?.mechanic_name || "Mechanic conversation"}
              subtitle="Use this thread for quotes, substitutions, pickup timing, and supply coordination."
              messages={threadMessages}
              draft={messageDraft}
              onDraftChange={setMessageDraft}
              onSend={handleSendMessage}
              loading={threadLoading}
              sending={messageSending}
              disabled={!selectedConversation}
              error={threadError}
              currentRole="warehouse"
              deleting={conversationDeleting}
              onDelete={handleDeleteConversation}
              emptyTitle="No messages yet"
              emptySubtitle="Reply here once a mechanic reaches out so the full sourcing conversation stays organized."
            />
          </div>
        ) : null}
      </div>

      {showAdd ? <AddWarehousePartModal onClose={() => setShowAdd(false)} onAdd={handleAddPart} /> : null}
    </div>
  );
}

function MetricTile({ label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff]",
    amber: "bg-[#fff7ed]",
    red: "bg-[#fef2f2]",
    emerald: "bg-[#ecfdf5]",
  };
  return (
    <div className={`rounded-[24px] border border-[#dbe7ff] px-4 py-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
    </div>
  );
}

function SummaryPanel({ label, value }) {
  return (
    <div className="rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#081224]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-[#eef2ff] bg-[#f8fbff] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="text-sm font-medium text-[#081224]">{value || "Not set"}</p>
    </div>
  );
}

function WarehouseOrderGroupDetail({ order, onUpdate, onOpenThread }) {
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.note || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(order.status);
    setNote(order.note || "");
  }, [order.note, order.status, order.order_ref]);

  const submit = async () => {
    setSaving(true);
    try {
      await onUpdate(order.order_ref, { status, note });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563eb]">{order.order_ref}</p>
          <p className="mt-2 text-lg font-semibold text-[#081224]">{order.mechanic_name}</p>
          <p className="mt-1 text-sm text-slate-500">{order.line_count} lines · {order.total_quantity} units</p>
          <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleString("en-US")}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[#081224]">{formatCurrencyUSD(order.total_price || 0)}</p>
          <button onClick={onOpenThread} className="mt-3 rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Open thread</button>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#dbe7ff] bg-white px-3 py-2 text-sm text-[#081224] outline-none"
            >
              {["requested", "accepted", "packed", "awaiting_shipping", "shipped", "out_for_delivery", "delivered", "cancelled"].map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <Field label="Warehouse note" value={note} onChange={setNote} />
        </div>
      </div>

      <div className="space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#081224]">{item.part_name || "Warehouse part"}</p>
                <p className="mt-1 text-sm text-slate-500">{item.part_number || "No part number"} · {item.manufacturer || "Generic supply"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{item.lead_time_label || "Lead time pending"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#081224]">Qty {item.quantity}</p>
                <p className="mt-1 text-sm text-slate-500">{formatCurrencyUSD(item.total_price || 0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={submit} disabled={saving} className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Update order"}
        </button>
      </div>
    </div>
  );
}

function AddWarehousePartModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    part_name: "",
    part_number: "",
    quantity: 0,
    min_threshold: 2,
    price: 0,
    compatible_vehicles: [],
    manufacturer: "",
    lead_time_label: "",
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
      setError(err.response?.data?.detail || "Could not add warehouse part");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[750] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Warehouse inventory</p>
            <h3 className="mt-1 text-xl font-semibold text-[#081224]">Add stocked part</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Part name" value={form.part_name} onChange={(value) => setForm((current) => ({ ...current, part_name: value }))} />
            <Field label="Part number" value={form.part_number} onChange={(value) => setForm((current) => ({ ...current, part_number: value }))} />
            <Field label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm((current) => ({ ...current, quantity: Number(value) }))} />
            <Field label="Min threshold" type="number" value={form.min_threshold} onChange={(value) => setForm((current) => ({ ...current, min_threshold: Number(value) }))} />
            <Field label="Price" type="number" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))} />
            <Field label="Manufacturer" value={form.manufacturer} onChange={(value) => setForm((current) => ({ ...current, manufacturer: value }))} />
            <div className="md:col-span-2">
              <Field label="Lead time" value={form.lead_time_label} onChange={(value) => setForm((current) => ({ ...current, lead_time_label: value }))} />
            </div>
          </div>
          {error ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Adding..." : "Add inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConversationSurface({
  title,
  subtitle,
  messages,
  draft,
  onDraftChange,
  onSend,
  loading,
  sending,
  disabled,
  error,
  currentRole,
  deleting,
  onDelete,
  emptyTitle,
  emptySubtitle,
}) {
  return (
    <Card className="flex h-[42rem] min-h-[42rem] flex-col overflow-hidden rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[#eef2ff] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conversation</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleting ? "Deleting..." : "Delete chat"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-[#e8eefc] bg-[#f8fbff] p-4">
        {loading ? <Spinner /> : null}
        {!loading && disabled ? <EmptyState icon="💬" title="Choose a mechanic thread" subtitle="Select a conversation from the inbox to continue the supply discussion." /> : null}
        {!loading && !disabled && messages.length === 0 ? <EmptyState icon="💬" title={emptyTitle} subtitle={emptySubtitle} /> : null}
        {!loading && !disabled && messages.length > 0 ? (
          <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[82%] rounded-[24px] px-4 py-3 ${
                  message.sender_role === currentRole ? "ml-auto bg-[#0f172a] text-white" : "bg-white text-[#081224] shadow-sm"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{message.sender_name}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                <p className={`mt-2 text-[11px] ${message.sender_role === currentRole ? "text-white/65" : "text-slate-400"}`}>
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
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex items-end gap-3">
        <textarea
          rows={3}
          value={draft}
          disabled={disabled}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={disabled ? "Select a conversation to start messaging." : "Type a message..."}
          className="min-h-[6rem] flex-1 rounded-[24px] border border-[#dbe7ff] bg-white px-4 py-3 text-sm text-[#081224] outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || sending || !draft.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          <Send size={16} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 text-sm text-[#081224] outline-none"
      />
    </label>
  );
}
