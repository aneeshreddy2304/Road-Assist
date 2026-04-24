import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  MessagesSquare,
  PackagePlus,
  Pencil,
  RefreshCw,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import {
  addPart,
  createWarehouseOrderGroup,
  deleteWarehouseThread,
  deletePart,
  getMechanicParts,
  getMyMechanicProfile,
  getWarehouseDetail,
  getWarehouseInbox,
  getWarehouseMarketplace,
  getWarehouseOrderDetail,
  getWarehouseOrders,
  getWarehouseThread,
  sendWarehouseMessage,
  updatePart,
} from "../api/endpoints";
import { Card, EmptyState, Spinner } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const marketplaceTabs = [
  { id: "inventory", label: "Workshop stock", icon: <Wrench size={16} /> },
  { id: "warehouses", label: "Warehouses", icon: <Store size={16} /> },
  { id: "orders", label: "Orders", icon: <ShoppingCart size={16} /> },
  { id: "messages", label: "Messages", icon: <MessagesSquare size={16} /> },
];

export default function Inventory() {
  const [tab, setTab] = useState("inventory");
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [warehouses, setWarehouses] = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedWarehouseDetail, setSelectedWarehouseDetail] = useState(null);
  const [warehouseDetailLoading, setWarehouseDetailLoading] = useState(false);
  const [marketplaceMessage, setMarketplaceMessage] = useState("");
  const [cartItems, setCartItems] = useState({});
  const [placingOrder, setPlacingOrder] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderRef, setSelectedOrderRef] = useState(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [conversationDeleting, setConversationDeleting] = useState(false);

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

  const loadWarehouses = async () => {
    setMarketplaceLoading(true);
    setMarketplaceMessage("");
    try {
      const res = await getWarehouseMarketplace();
      setWarehouses(res.data);
      setSelectedWarehouse((current) => {
        if (!res.data.length) return null;
        if (!current) return res.data[0];
        return res.data.find((item) => item.id === current.id) || res.data[0];
      });
    } catch (err) {
      setMarketplaceMessage(err.response?.data?.detail || "Could not load warehouses");
    } finally {
      setMarketplaceLoading(false);
    }
  };

  const loadWarehouseDetail = async (warehouseId = selectedWarehouse?.id, { background = false } = {}) => {
    if (!warehouseId) {
      setSelectedWarehouseDetail(null);
      return;
    }
    if (!background) {
      setWarehouseDetailLoading(true);
    }
    try {
      const res = await getWarehouseDetail(warehouseId);
      setSelectedWarehouseDetail(res.data);
    } catch (err) {
      setMarketplaceMessage(err.response?.data?.detail || "Could not load warehouse details");
    } finally {
      if (!background) {
        setWarehouseDetailLoading(false);
      }
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

  const loadThread = async (warehouseId = selectedConversation?.warehouse_id, { background = false } = {}) => {
    if (!warehouseId) {
      setThreadMessages([]);
      setThreadError("");
      return;
    }
    if (!background) {
      setThreadLoading(true);
      setThreadError("");
    }
    try {
      const res = await getWarehouseThread({ warehouse_id: warehouseId });
      setThreadMessages(res.data);
    } catch (err) {
      setThreadMessages([]);
      setThreadError(err.response?.data?.detail || "Could not load messages");
    } finally {
      if (!background) {
        setThreadLoading(false);
      }
    }
  };

  useEffect(() => {
    loadInventory();
    loadWarehouses();
    loadOrders();
    loadInbox();
  }, []);

  useEffect(() => {
    if (!selectedWarehouse?.id) {
      setSelectedWarehouseDetail(null);
      return;
    }
    loadWarehouseDetail(selectedWarehouse.id);
  }, [selectedWarehouse?.id]);

  useEffect(() => {
    if (!selectedOrderRef) {
      setSelectedOrderDetail(null);
      return;
    }
    loadOrderDetail(selectedOrderRef);
  }, [selectedOrderRef]);

  useEffect(() => {
    if (!selectedConversation?.warehouse_id) return;
    loadThread(selectedConversation.warehouse_id);
    const timer = window.setInterval(() => {
      loadThread(selectedConversation.warehouse_id, { background: true });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selectedConversation?.warehouse_id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadOrders();
      loadInbox();
      loadInventory();
      if (selectedWarehouse?.id) {
        loadWarehouseDetail(selectedWarehouse.id, { background: true });
      }
      if (selectedOrderRef) {
        loadOrderDetail(selectedOrderRef, { background: true });
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedWarehouse?.id, selectedOrderRef]);

  const lowStock = useMemo(() => parts.filter((part) => Number(part.quantity) < 4), [parts]);
  const outOfStock = useMemo(() => parts.filter((part) => Number(part.quantity) === 0), [parts]);
  const totalValue = useMemo(
    () => parts.reduce((sum, part) => sum + Number(part.price || 0) * Number(part.quantity || 0), 0),
    [parts]
  );
  const pendingOrders = useMemo(() => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)), [orders]);
  const filteredWarehouseInventory = useMemo(() => {
    const inventory = selectedWarehouseDetail?.inventory || [];
    return inventory;
  }, [selectedWarehouseDetail?.inventory]);
  const cartSummary = useMemo(() => {
    const inventory = selectedWarehouseDetail?.inventory || [];
    return inventory.reduce(
      (summary, part) => {
        const quantity = Number(cartItems[part.id] || 0);
        if (!quantity) return summary;
        summary.lineCount += 1;
        summary.totalQuantity += quantity;
        summary.totalPrice += quantity * Number(part.price || 0);
        return summary;
      },
      { lineCount: 0, totalQuantity: 0, totalPrice: 0 }
    );
  }, [cartItems, selectedWarehouseDetail?.inventory]);

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

  const updateCartItem = (partId, nextQuantity) => {
    setCartItems((current) => {
      const quantity = Math.max(0, Number(nextQuantity) || 0);
      if (!quantity) {
        const { [partId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [partId]: quantity };
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedWarehouseDetail?.id || !cartSummary.lineCount) return;
    setPlacingOrder(true);
    setMarketplaceMessage("");
    try {
      await createWarehouseOrderGroup({
        warehouse_id: selectedWarehouseDetail.id,
        items: Object.entries(cartItems).map(([warehouse_part_id, quantity]) => ({
          warehouse_part_id,
          quantity: Number(quantity),
        })),
        note: `Grouped warehouse order for ${cartSummary.totalQuantity} item(s).`,
      });
      setCartItems({});
      await Promise.all([loadOrders(), loadInbox(), loadWarehouseDetail(selectedWarehouseDetail.id)]);
      setTab("orders");
    } catch (err) {
      setMarketplaceMessage(err.response?.data?.detail || "Could not place warehouse order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation?.warehouse_id || !messageDraft.trim()) return;
    setMessageSending(true);
    setThreadError("");
    try {
      await sendWarehouseMessage({
        warehouse_id: selectedConversation.warehouse_id,
        message: messageDraft.trim(),
      });
      setMessageDraft("");
      await Promise.all([loadThread(selectedConversation.warehouse_id), loadInbox()]);
    } catch (err) {
      setThreadError(err.response?.data?.detail || "Could not send message");
    } finally {
      setMessageSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation?.warehouse_id || conversationDeleting) return;
    const confirmed = window.confirm(`Delete this supplier chat with ${selectedConversation.warehouse_name || "this warehouse"}?`);
    if (!confirmed) return;

    setConversationDeleting(true);
    setThreadError("");
    try {
      await deleteWarehouseThread({ warehouse_id: selectedConversation.warehouse_id });
      const currentWarehouseId = selectedConversation.warehouse_id;
      setInbox((current) => current.filter((item) => item.warehouse_id !== currentWarehouseId));
      setSelectedConversation((current) => (current?.warehouse_id === currentWarehouseId ? null : current));
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mechanic supply operations</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Inventory, sourcing, and supplier chat</h1>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:w-[28rem]">
              <MetricTile label="Tracked parts" value={parts.length} tone="blue" />
              <MetricTile label="Open warehouse orders" value={pendingOrders.length} tone="amber" />
              <MetricTile label="Supplier threads" value={inbox.length} tone="slate" />
              <MetricTile label="Stock value" value={formatCurrencyUSD(totalValue)} tone="emerald" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-full border border-[#dbe7ff] bg-white p-2 shadow-sm">
          {marketplaceTabs.map((item) => (
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

        {tab === "inventory" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InventoryStat label="Tracked parts" value={parts.length} tone="blue" />
              <InventoryStat label="Low stock" value={lowStock.length} tone="amber" />
              <InventoryStat label="Out of stock" value={outOfStock.length} tone="red" />
              <InventoryStat label="Inventory value" value={formatCurrencyUSD(totalValue)} tone="slate" />
            </div>

            <div className="flex flex-col gap-4 rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#081224]">Workshop stock register</p>
                <p className="mt-1 text-sm text-slate-500">Your own carried stock still lives here exactly as before.</p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                <PackagePlus size={16} />
                Add part
              </button>
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
          </>
        ) : null}

        {tab === "warehouses" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Warehouse network</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{warehouses.length} suppliers</h2>
                  <p className="mt-2 text-sm text-slate-500">All warehouses enrolled in the system appear here automatically.</p>
                </div>
                <div className="flex items-center gap-3">
                  {marketplaceLoading ? <Spinner /> : null}
                  <button
                    type="button"
                    onClick={() => loadWarehouses()}
                    className="inline-flex items-center gap-2 rounded-full border border-[#dbe7ff] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-[#f8fbff]"
                  >
                    <RefreshCw size={14} />
                    Refresh list
                  </button>
                </div>
              </div>

              {marketplaceMessage ? <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{marketplaceMessage}</p> : null}

              <div className="mt-4 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {warehouses.map((warehouse) => (
                  <button
                    key={warehouse.id}
                    onClick={() => {
                      setSelectedWarehouse(warehouse);
                    }}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      selectedWarehouse?.id === warehouse.id
                        ? "border-[#2563eb] bg-[#f8fbff]"
                        : "border-[#dbe7ff] bg-white hover:bg-[#fbfdff]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#081224]">{warehouse.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{warehouse.address}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">{warehouse.average_shipping_time || warehouse.fulfillment_hours || "Shipping window pending"}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {warehouse.available_parts} parts
                        </span>
                        <p className="mt-3 text-xs text-slate-400">{warehouse.email || "Warehouse contact available after selection"}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              {selectedWarehouseDetail ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-[#eef2ff] pb-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected supplier</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{selectedWarehouseDetail.name}</h2>
                      <p className="mt-2 max-w-2xl text-sm text-slate-500">{selectedWarehouseDetail.description}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <WarehouseDetailChip label="Email" value={selectedWarehouseDetail.email} />
                        <WarehouseDetailChip label="Phone" value={selectedWarehouseDetail.contact_phone} />
                        <WarehouseDetailChip label="Street address" value={selectedWarehouseDetail.address} />
                        <WarehouseDetailChip label="Average shipping time" value={selectedWarehouseDetail.average_shipping_time} />
                        <WarehouseDetailChip label="Fulfillment hours" value={selectedWarehouseDetail.fulfillment_hours} />
                        <WarehouseDetailChip label="Inventory units" value={`${selectedWarehouseDetail.total_stock_units}`} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          setSelectedConversation({
                            warehouse_id: selectedWarehouseDetail.id,
                            warehouse_name: selectedWarehouseDetail.name,
                            mechanic_id: "",
                            mechanic_name: "",
                          });
                          setTab("messages");
                        }}
                        className="rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-[#2563eb] hover:bg-[#f8fbff]"
                      >
                        Message warehouse
                      </button>
                      <div className="rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selection</p>
                        <p className="mt-2 text-2xl font-semibold text-[#081224]">{cartSummary.lineCount} lines</p>
                        <p className="mt-1 text-sm text-slate-500">{cartSummary.totalQuantity} total units · {formatCurrencyUSD(cartSummary.totalPrice)}</p>
                        <button
                          onClick={handlePlaceOrder}
                          disabled={!cartSummary.lineCount || placingOrder}
                          className="mt-4 w-full rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {placingOrder ? "Placing..." : "Place grouped order"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {warehouseDetailLoading ? (
                    <Spinner />
                  ) : filteredWarehouseInventory.length === 0 ? (
                    <EmptyState icon="📦" title="No visible inventory items" subtitle="Try a broader part search or pick another warehouse from the network." />
                  ) : (
                    <div className="mt-4 grid max-h-[42rem] gap-3 overflow-y-auto pr-1">
                      {filteredWarehouseInventory.map((part) => (
                        <div key={part.id} className="rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                              <p className="text-lg font-semibold text-[#081224]">{part.part_name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {part.part_number || "No part number"} · {part.manufacturer || "Generic supply"}
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                                {part.warehouse_name} · {part.lead_time_label || "Pickup timing on request"}
                              </p>
                              {part.compatible_vehicles?.length ? (
                                <p className="mt-2 text-sm text-slate-500">Compatible: {part.compatible_vehicles.join(", ")}</p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-semibold text-[#081224]">{formatCurrencyUSD(part.price)}</p>
                              <p className="mt-1 text-sm text-slate-500">{part.quantity} units available</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center rounded-full border border-[#dbe7ff] bg-white px-2 py-1">
                              <button
                                onClick={() => updateCartItem(part.id, Number(cartItems[part.id] || 0) - 1)}
                                className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-[#f8fbff]"
                              >
                                -
                              </button>
                              <span className="min-w-[3rem] text-center text-sm font-semibold text-[#081224]">
                                {cartItems[part.id] || 0}
                              </span>
                              <button
                                onClick={() => updateCartItem(part.id, Math.min(Number(part.quantity), Number(cartItems[part.id] || 0) + 1))}
                                className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-[#f8fbff]"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedConversation({
                                  warehouse_id: part.warehouse_id,
                                  warehouse_name: part.warehouse_name,
                                  mechanic_id: "",
                                  mechanic_name: "",
                                });
                                setTab("messages");
                              }}
                              className="rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
                            >
                              Message warehouse
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <EmptyState icon="🏬" title="Choose a warehouse" subtitle="Select a supplier on the left to explore stock and open a sourcing thread." />
              )}
            </Card>
          </div>
        ) : null}

        {tab === "orders" ? (
          <div className="grid gap-4 xl:grid-cols-[0.82fr,1.18fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Supplier orders</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#081224]">Warehouse purchase stream</h2>
                </div>
                {ordersLoading ? <Spinner /> : null}
              </div>

              {orders.length === 0 ? (
                <EmptyState icon="🧾" title="No warehouse orders yet" subtitle="When you place an order from the marketplace, it will land here with live status updates." />
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
                          <p className="mt-2 text-lg font-semibold text-[#081224]">{order.warehouse_name}</p>
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
                <>
                  <div className="flex flex-col gap-3 border-b border-[#eef2ff] pb-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563eb]">{selectedOrderDetail.order_ref}</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{selectedOrderDetail.warehouse_name}</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {selectedOrderDetail.status.replaceAll("_", " ")} · {selectedOrderDetail.total_quantity} units · {formatCurrencyUSD(selectedOrderDetail.total_price || 0)}
                      </p>
                      {selectedOrderDetail.note ? <p className="mt-3 text-sm text-slate-600">{selectedOrderDetail.note}</p> : null}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedConversation({
                          warehouse_id: selectedOrderDetail.warehouse_id,
                          warehouse_name: selectedOrderDetail.warehouse_name,
                        });
                        setTab("messages");
                      }}
                      className="rounded-full border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
                    >
                      Open thread
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedOrderDetail.items.map((item) => (
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
                </>
              ) : (
                <EmptyState icon="🧾" title="Choose an order" subtitle="Select an order from the left to inspect live status and the exact parts in that shipment." />
              )}
            </Card>
          </div>
        ) : null}

        {tab === "messages" ? (
          <div className="grid gap-4 xl:grid-cols-[0.78fr,1.22fr]">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Supplier inbox</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#081224]">{inbox.length} active threads</h2>
                </div>
                {inboxLoading ? <Spinner /> : null}
              </div>
              <div className="mt-5 space-y-3">
                {inbox.length === 0 ? (
                  <EmptyState icon="💬" title="No supplier chats yet" subtitle="Start a conversation from a warehouse card or an order to keep pricing and pickup details in one place." />
                ) : (
                  inbox.map((thread) => (
                    <button
                      key={`${thread.warehouse_id}-${thread.mechanic_id}`}
                      onClick={() => setSelectedConversation(thread)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selectedConversation?.warehouse_id === thread.warehouse_id
                          ? "border-[#2563eb] bg-[#f8fbff]"
                          : "border-[#dbe7ff] bg-white hover:bg-[#fbfdff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#081224]">{thread.warehouse_name}</p>
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
              title={selectedConversation?.warehouse_name || "Supplier conversation"}
              subtitle="Use this thread for pricing, substitutions, pickup windows, and long-form order notes."
              messages={threadMessages}
              draft={messageDraft}
              onDraftChange={setMessageDraft}
              onSend={handleSendMessage}
              loading={threadLoading}
              sending={messageSending}
              disabled={!selectedConversation}
              error={threadError}
              currentRole="mechanic"
              deleting={conversationDeleting}
              onDelete={handleDeleteConversation}
              emptyTitle="No supplier messages yet"
              emptySubtitle="Open the conversation with the warehouse and keep everything tied to the sourcing workflow."
            />
          </div>
        ) : null}
      </div>

      {showAdd ? <AddPartModal onAdd={handleAdd} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}

function MetricTile({ label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff]",
    amber: "bg-[#fff7ed]",
    slate: "bg-[#f8fafc]",
    emerald: "bg-[#ecfdf5]",
  };
  return (
    <div className={`rounded-[24px] border border-[#dbe7ff] px-4 py-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
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

function WarehouseDetailChip({ label, value }) {
  return (
    <div className="rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-[#081224]">{value || "Not provided"}</p>
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

      <div className="mt-4 min-h-0 flex-1 rounded-[24px] border border-[#e8eefc] bg-[#f8fbff] p-4 overflow-hidden">
        {loading ? <Spinner /> : null}
        {!loading && disabled ? <EmptyState icon="💬" title="Pick a supplier thread" subtitle="Choose a warehouse on the left to open the message stream." /> : null}
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
