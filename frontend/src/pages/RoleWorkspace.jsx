import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, CalendarDays, Check, ChevronRight, ClipboardList, LoaderCircle, MapPinned, MessageCircle, Package, Plus, ReceiptText, ShieldCheck, ShoppingBag, UserRound, Wrench, X } from "lucide-react";
import {
  addPart, addWarehousePart, approveMechanicRegistration, approveWarehouseRegistration,
  getAlerts, getAllMechanics, getAllOwners, getAllWarehouses, getAnalytics,
  getMechanicParts, getMyMechanicProfile, getMyWarehouseProfile, getOpenRequests,
  getWarehouseInbox, getWarehouseInventory, getWarehouseOrders, getWarehouseThread,
  getMessageInbox, getMessageThread, sendMessage, sendWarehouseMessage, listAppointments,
  listRequests, updateRequestStatus, updateWarehouseOrderGroup,
} from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { formatCurrencyUSD } from "../lib/formatters";

const roleTabs = {
  mechanic: [["overview", "Overview", Activity], ["jobs", "Jobs", ClipboardList], ["appointments", "Appointments", CalendarDays], ["inventory", "Inventory", Package], ["messages", "Messages", MessageCircle]],
  warehouse: [["overview", "Overview", Activity], ["orders", "Orders", ShoppingBag], ["inventory", "Inventory", Package], ["messages", "Messages", MessageCircle]],
  admin: [["overview", "Overview", Activity], ["approvals", "Approvals", ShieldCheck], ["people", "People", UserRound], ["requests", "Requests", ClipboardList], ["alerts", "Alerts", AlertTriangle]],
};
const nextJob = { requested: "accepted", accepted: "in_progress", in_progress: "completed" };
const nextOrder = { requested: "accepted", accepted: "packed", packed: "awaiting_shipping", awaiting_shipping: "shipped", shipped: "out_for_delivery", out_for_delivery: "delivered" };
const pretty = (value) => String(value || "").replaceAll("_", " ");
const when = (value) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled";

export default function RoleWorkspace({ role }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const tabs = roleTabs[role];
  const requested = params.get("tab");
  const tab = tabs.some((item) => item[0] === requested) ? requested : "overview";
  const setTab = (value) => setParams(value === "overview" ? {} : { tab: value });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (role === "mechanic") {
        const profile = await getMyMechanicProfile();
        const values = await Promise.all([
          listRequests(), listAppointments(), getMechanicParts(profile.data.mechanic_id), getAlerts(),
          getOpenRequests({ lat: Number(profile.data.lat) || 34.0522, lng: Number(profile.data.lng) || -118.2437, radius_km: 30 }).catch(() => ({ data: [] })),
        ]);
        setData({ profile: profile.data, jobs: values[0].data, appointments: values[1].data, inventory: values[2].data, alerts: values[3].data, open: values[4].data });
      } else if (role === "warehouse") {
        const values = await Promise.all([getMyWarehouseProfile(), getWarehouseOrders(), getWarehouseInventory(), getWarehouseInbox()]);
        setData({ profile: values[0].data, orders: values[1].data, inventory: values[2].data, inbox: values[3].data });
      } else {
        const values = await Promise.all([getAnalytics({ range: "month" }), getAllMechanics(), getAllWarehouses(), getAllOwners(), listRequests().catch(() => ({ data: [] }))]);
        setData({ analytics: values[0].data, mechanics: values[1].data, warehouses: values[2].data, owners: values[3].data, requests: values[4].data });
      }
    } catch (err) { setError(err.response?.data?.detail || "We could not load this workspace."); }
    finally { setLoading(false); }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  const changeJob = async (job) => {
    const status = nextJob[job.status]; if (!status) return;
    setWorking(job.id);
    try { await updateRequestStatus(job.id, { status, note: "Updated through the Wingman workspace" }); await load(); }
    catch (err) { setError(err.response?.data?.detail || "This job could not be updated."); }
    finally { setWorking(""); }
  };
  const changeOrder = async (order) => {
    const status = nextOrder[order.status]; if (!status) return;
    setWorking(order.order_ref);
    try { await updateWarehouseOrderGroup(order.order_ref, { status, note: "Updated in the fulfillment workspace" }); await load(); }
    catch (err) { setError(err.response?.data?.detail || "This order could not be updated."); }
    finally { setWorking(""); }
  };
  const approve = async (kind, item) => {
    setWorking(item.id);
    try { if (kind === "mechanic") await approveMechanicRegistration(item.id); else await approveWarehouseRegistration(item.id); await load(); }
    catch (err) { setError(err.response?.data?.detail || "This account could not be approved."); }
    finally { setWorking(""); }
  };

  const copy = role === "mechanic"
    ? ["Your work, in motion.", "Requests, appointments, inventory, and customer context in one operational view."]
    : role === "warehouse"
      ? ["Fulfillment that stays in motion.", "Keep stock, orders, delivery stages, and conversations close to the work."]
      : ["A clear view of the network.", "Review people, providers, service requests, and network signals from one place."];

  return <main className="ops-workspace"><div className="ops-wrap">
    <aside className="ops-sidebar">
      <Link to="/workspace" className="ops-sidebar-brand"><span><Wrench size={18} /></span><b>wingman</b></Link>
      <p>{role === "admin" ? "Network controls" : role + " workspace"}</p>
      <nav>{tabs.map(([id, label, Icon]) => <button aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
      <div className="ops-sidebar-bottom"><Link to="/profile"><UserRound size={17} /> Profile</Link>{role === "mechanic" ? <Link to="/billing"><ReceiptText size={17} /> Billing</Link> : null}<span>{user?.name}</span></div>
    </aside>
    <section className="ops-main">
      <header className="ops-topbar"><div><span>{role === "admin" ? "California network" : "Live workspace"}</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div><button onClick={load} className="ops-refresh">Refresh</button></header>
      {error ? <div className="ops-error">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div> : null}
      {loading ? <div className="ops-loading"><LoaderCircle className="animate-spin" /> Loading live workspace…</div> : <Content role={role} tab={tab} data={data} setTab={setTab} working={working} changeJob={changeJob} changeOrder={changeOrder} approve={approve} setAddOpen={setAddOpen} />}
    </section>
  </div>{addOpen ? <InventoryModal role={role} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} /> : null}</main>;
}

function Content({ role, ...props }) {
  if (role === "mechanic") return <Mechanic {...props} />;
  if (role === "warehouse") return <Warehouse {...props} />;
  return <Admin {...props} />;
}

function Mechanic({ tab, data, setTab, working, changeJob, setAddOpen }) {
  const jobs = data.jobs || []; const active = jobs.filter((x) => ["accepted", "in_progress"].includes(x.status)); const low = (data.inventory || []).filter((x) => Number(x.quantity) < 4);
  if (tab === "overview") return <><Stats items={[["Today’s jobs", jobs.length, Wrench], ["New requests", (data.open || []).length, MapPinned], ["Appointments", (data.appointments || []).length, CalendarDays], ["Low-stock parts", low.length, Package]]} /><div className="ops-grid"><Panel title="Your work, in motion" action={() => setTab("jobs")}><WorkList items={[...active, ...(data.open || []).filter((x) => !active.some((a) => a.id === x.id))].slice(0, 5)} working={working} onUpdate={changeJob} /></Panel><Panel title="Coming up today"><Schedule items={(data.appointments || []).slice(0, 5)} /></Panel></div><div className="ops-grid ops-grid-small"><Panel title="Keep your shelf ready" action={() => setTab("inventory")}><Alerts items={low.map((x) => [x.part_name, x.quantity + " left · restock recommended"])} empty="Your stocked parts are in good shape." /></Panel><Panel title="Requests nearby" action={() => setTab("jobs")}><Alerts items={(data.open || []).slice(0, 3).map((x) => [x.problem_desc, (x.vehicle_label || "Vehicle") + " · " + (x.owner_address || "Location shared")])} empty="No nearby requests right now." /></Panel></div></>;
  if (tab === "jobs") return <section><PageHeading title="Jobs" text="Move every job from request to completion with the details close by." /><div className="ops-record-grid">{[...jobs, ...(data.open || []).filter((x) => !jobs.some((job) => job.id === x.id))].map((job) => <article className="ops-job-card" key={job.id}><div><span>{job.request_ref || "REQUEST"}</span><Status value={job.status} /></div><h3>{job.problem_desc}</h3><p>{job.vehicle_label || "Vehicle details pending"}</p><small><MapPinned size={14} /> {job.owner_address || "Location shared securely"}</small><footer>{nextJob[job.status] ? <button disabled={working === job.id} onClick={() => changeJob(job)}>{working === job.id ? "Updating…" : job.status === "requested" ? "Accept request" : job.status === "accepted" ? "Begin work" : "Complete work"}<ArrowRight size={16} /></button> : <b>Completed</b>}</footer></article>)}</div></section>;
  if (tab === "appointments") return <section><PageHeading title="Appointments" text="Scheduled customer visits and shop work in one calendar list." /><Table columns={["When", "Service", "Vehicle", "Owner", "Status"]} rows={(data.appointments || []).map((x) => [when(x.scheduled_for), x.service_type || "Service visit", x.vehicle_label || "Vehicle", x.owner_name || "Owner", <Status value={x.status} />])} empty="No appointments are scheduled yet." /></section>;
  if (tab === "inventory") return <section><PageHeading title="Inventory" text="Stock on hand is connected to the jobs you take." action={<button onClick={() => setAddOpen(true)}><Plus size={16} /> Add inventory</button>} /><Table columns={["Part", "SKU", "In stock", "Price", "State"]} rows={(data.inventory || []).map((x) => [x.part_name, x.part_number || "—", x.quantity, formatCurrencyUSD(x.price || 0), <Status value={Number(x.quantity) < 4 ? "low stock" : "in stock"} />])} empty="No inventory has been added." /></section>;
  return <Messages role="mechanic" />;
}

function Warehouse({ tab, data, setTab, working, changeOrder, setAddOpen }) {
  const orders = data.orders || []; const inventory = data.inventory || []; const low = inventory.filter((x) => Number(x.quantity) <= Number(x.min_threshold));
  if (tab === "overview") return <><Stats items={[["Open orders", orders.filter((x) => !["delivered", "cancelled"].includes(x.status)).length, ShoppingBag], ["Products in stock", inventory.length, Package], ["Low-stock items", low.length, AlertTriangle], ["Messages", (data.inbox || []).length, MessageCircle]]} /><div className="ops-grid"><Panel title="Orders in motion" action={() => setTab("orders")}><OrderList items={orders.slice(0, 5)} working={working} onUpdate={changeOrder} /></Panel><Panel title="Delivery rhythm"><Schedule items={orders.slice(0, 5).map((x) => ({ scheduled_for: x.updated_at || x.created_at, service_type: x.order_ref, vehicle_label: x.mechanic_name }))} /></Panel></div><Panel title="Shelf check" action={() => setTab("inventory")}><Alerts items={low.map((x) => [x.part_name, x.quantity + " available · threshold " + x.min_threshold])} empty="No products need a restock." /></Panel></>;
  if (tab === "orders") return <section><PageHeading title="Orders" text="Each order follows one clear fulfillment path." /><OrderList items={orders} working={working} onUpdate={changeOrder} expanded /></section>;
  if (tab === "inventory") return <section><PageHeading title="Inventory" text="Manage live product availability and fixed prices." action={<button onClick={() => setAddOpen(true)}><Plus size={16} /> Add product</button>} /><Table columns={["Product", "Part number", "Quantity", "Price", "State"]} rows={inventory.map((x) => [x.part_name, x.part_number || "—", x.quantity, formatCurrencyUSD(x.price || 0), <Status value={Number(x.quantity) <= Number(x.min_threshold) ? "low stock" : "in stock"} />])} empty="No products have been added." /></section>;
  return <Messages role="warehouse" count={(data.inbox || []).length} />;
}

function Admin({ tab, data, setTab, working, approve }) {
  const summary = data.analytics?.summary || {}; const mechanics = data.mechanics || []; const warehouses = data.warehouses || []; const pendingM = mechanics.filter((x) => x.approval_status !== "approved"); const pendingW = warehouses.filter((x) => x.approval_status !== "approved");
  if (tab === "overview") return <><Stats items={[["Accounts", Number(summary.total_users || mechanics.length + warehouses.length + (data.owners || []).length), UserRound], ["Active requests", Number(summary.active || 0), Wrench], ["Provider approvals", pendingM.length + pendingW.length, ShieldCheck], ["Completed", Number(summary.completed || 0), Check]]} /><div className="ops-grid"><Panel title="Activity across the network" action={() => setTab("requests")}><Network summary={summary} /></Panel><Panel title="Provider approvals" action={() => setTab("approvals")}><Alerts items={[...pendingM, ...pendingW].slice(0, 5).map((x) => [x.name || x.business_name || "Provider", (x.specialization || x.address || "Provider registration") + " · awaiting review"])} empty="No provider registrations need review." /></Panel></div></>;
  if (tab === "approvals") return <section><PageHeading title="Approvals" text="Review provider registrations before they appear in the Wingman network." /><div className="ops-record-grid">{[...pendingM.map((x) => ({ ...x, kind: "mechanic" })), ...pendingW.map((x) => ({ ...x, kind: "warehouse" }))].map((item) => <article className="ops-job-card" key={item.kind + item.id}><div><span>{item.kind}</span><Status value="pending review" /></div><h3>{item.name || item.business_name}</h3><p>{item.specialization || item.address || "Profile ready for review"}</p><footer><button disabled={working === item.id} onClick={() => approve(item.kind, item)}>{working === item.id ? "Approving…" : "Approve provider"}<Check size={16} /></button></footer></article>)}</div></section>;
  if (tab === "people") return <section><PageHeading title="People" text="Every Wingman account, kept in one clear directory." /><Table columns={["Account", "Role", "Email", "State"]} rows={[...mechanics.map((x) => [x.name, "Mechanic", x.email, <Status value={x.approval_status || "active"} />]), ...warehouses.map((x) => [x.name, "Warehouse", x.email, <Status value={x.approval_status || "active"} />]), ...(data.owners || []).map((x) => [x.name, "Owner", x.email, <Status value={x.is_active === false ? "inactive" : "active"} />])]} empty="No accounts found." /></section>;
  if (tab === "requests") return <section><PageHeading title="Service requests" text="Network-wide request activity and current state." /><Table columns={["Reference", "Issue", "Vehicle", "Owner", "Status"]} rows={(data.requests || []).map((x) => [x.request_ref, x.problem_desc, x.vehicle_label, x.owner_name, <Status value={x.status} />])} empty="No requests found." /></section>;
  return <section><PageHeading title="Alerts" text="Provider alerts are actionable in the relevant live workspace." /><div className="ops-empty"><ShieldCheck size={25} /><h2>No central alerts</h2><p>Stock and service alerts remain visible to the provider who can resolve them.</p></div></section>;
}

function Stats({ items }) { return <section className="ops-stat-grid">{items.map(([label, value, Icon]) => <article key={label}><Icon size={18} /><span>{label}</span><b>{value}</b><small>Live workspace data</small></article>)}</section>; }
function Panel({ title, action, children }) { return <section className="ops-panel"><header><h2>{title}</h2>{action ? <button onClick={action}>View all <ChevronRight size={16} /></button> : null}</header>{children}</section>; }
function PageHeading({ title, text, action }) { return <header className="ops-page-heading"><div><span>Wingman workspace</span><h2>{title}</h2><p>{text}</p></div>{action}</header>; }
function Status({ value }) { return <i className={"ops-status " + String(value || "").replaceAll("_", "-").replaceAll(" ", "-")}>{pretty(value)}</i>; }
function WorkList({ items, working, onUpdate }) { return items.length ? <div className="ops-work-list">{items.map((job) => <article key={job.id}><span className="ops-icon"><Wrench size={18} /></span><div><b>{job.problem_desc}</b><p>{job.vehicle_label || "Vehicle"} · {job.owner_name || "Vehicle owner"}</p></div><Status value={job.status} />{nextJob[job.status] ? <button disabled={working === job.id} onClick={() => onUpdate(job)} aria-label={"Update " + job.problem_desc}><ArrowRight size={17} /></button> : null}</article>)}</div> : <p className="ops-empty-inline">Nothing is waiting for you right now.</p>; }
function OrderList({ items, working, onUpdate, expanded = false }) { return items.length ? <div className={"ops-order-list " + (expanded ? "expanded" : "")}>{items.map((order) => <article key={order.order_ref}><div><span>{order.order_ref}</span><b>{order.part_name || "Parts order"}</b><p>{order.mechanic_name || "Customer"} · {order.quantity} item{Number(order.quantity) === 1 ? "" : "s"}</p></div><Status value={order.status} />{nextOrder[order.status] ? <button disabled={working === order.order_ref} onClick={() => onUpdate(order)}>{working === order.order_ref ? "Updating…" : pretty(nextOrder[order.status])}<ArrowRight size={16} /></button> : <b className="ops-complete">Delivered</b>}</article>)}</div> : <p className="ops-empty-inline">No orders are in fulfillment.</p>; }
function Schedule({ items }) { return items.length ? <div className="ops-schedule">{items.map((item, index) => <article key={item.id || index}><span>{when(item.scheduled_for)}</span><div><b>{item.service_type || item.order_ref || "Service"}</b><p>{item.vehicle_label || item.mechanic_name || "Vehicle"}</p></div><i /></article>)}</div> : <p className="ops-empty-inline">Nothing is scheduled yet.</p>; }
function Alerts({ items, empty }) { return items.length ? <div className="ops-alert-list">{items.map(([title, detail], index) => <article key={title + index}><AlertTriangle size={17} /><div><b>{title}</b><p>{detail}</p></div></article>)}</div> : <p className="ops-empty-inline">{empty}</p>; }
function Network({ summary }) { return <div className="ops-network-stats">{[["Requested", summary.requested || 0], ["Accepted", summary.accepted || 0], ["In progress", summary.in_progress || 0], ["Completed", summary.completed || 0]].map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div>; }
function Table({ columns, rows, empty }) { return <div className="ops-table-wrap">{rows.length ? <table><thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, key) => <td key={key}>{cell}</td>)}</tr>)}</tbody></table> : <p className="ops-empty-inline">{empty}</p>}</div>; }
function Messages({ role, count = 0 }) {
  const [inbox, setInbox] = useState([]); const [selected, setSelected] = useState(null); const [messages, setMessages] = useState([]); const [draft, setDraft] = useState(""); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState("");
  const loadInbox = useCallback(async () => { setLoading(true); try { const result = role === "warehouse" ? await getWarehouseInbox() : await getMessageInbox(); setInbox(result.data || []); setSelected((current) => current ? (result.data || []).find((item) => (role === "warehouse" ? item.mechanic_id === current.mechanic_id : item.owner_id === current.owner_id) && (item.request_id || null) === (current.request_id || null)) || result.data?.[0] : result.data?.[0] || null); } catch (err) { setError(err.response?.data?.detail || "Could not load conversations."); } finally { setLoading(false); } }, [role]);
  useEffect(() => { loadInbox(); }, [loadInbox]);
  useEffect(() => { if (!selected) { setMessages([]); return; } const loadThread = async () => { try { const result = role === "warehouse" ? await getWarehouseThread({ mechanic_id: selected.mechanic_id }) : await getMessageThread({ owner_id: selected.owner_id, request_id: selected.request_id || undefined }); setMessages(result.data || []); } catch (err) { setError(err.response?.data?.detail || "Could not open this conversation."); } }; loadThread(); }, [selected, role]);
  const send = async (event) => { event.preventDefault(); if (!draft.trim() || !selected) return; setSending(true); try { const payload = role === "warehouse" ? { mechanic_id: selected.mechanic_id, warehouse_order_id: selected.warehouse_order_id || undefined, message: draft.trim() } : { owner_id: selected.owner_id, request_id: selected.request_id || undefined, message: draft.trim() }; const result = role === "warehouse" ? await sendWarehouseMessage(payload) : await sendMessage(payload); setMessages((current) => [...current, result.data]); setDraft(""); } catch (err) { setError(err.response?.data?.detail || "Your message could not be sent."); } finally { setSending(false); } };
  return <section><PageHeading title="Messages" text="Conversations stay tied to the live job or fulfillment order they support." /><div className="ops-message-layout"><aside>{loading ? <p>Loading conversations…</p> : inbox.length ? inbox.map((thread, index) => <button className={selected === thread ? "selected" : ""} key={(thread.owner_id || thread.mechanic_id || index) + String(thread.request_id || "")} onClick={() => setSelected(thread)}><b>{thread.counterpart_name || thread.mechanic_name || "Conversation"}</b><span>{thread.latest_message || "Open conversation"}</span></button>) : <p>No active conversations yet.</p>}</aside><div className="ops-thread">{selected ? <><header><MessageCircle size={18} /><div><b>{selected.counterpart_name || selected.mechanic_name || "Conversation"}</b><span>{selected.request_ref || selected.order_ref || "Live work context"}</span></div></header><div className="ops-thread-messages">{messages.length ? messages.map((message) => <article className={message.sender_role === role ? "own" : ""} key={message.id}><p>{message.message}</p><small>{when(message.created_at)}</small></article>) : <p>Start the conversation when you are ready.</p>}</div><form onSubmit={send}><input aria-label="Message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" /><button disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}<ArrowRight size={15} /></button></form></> : <div className="ops-empty"><MessageCircle size={26} /><h2>{count ? count + " active conversations" : "No conversations yet"}</h2><p>When a message starts around a job or order, it will stay connected to that work here.</p></div>}</div></div>{error ? <p className="ops-message-error">{error}</p> : null}</section>;
}
function InventoryModal({ role, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", sku: "", quantity: "", price: "", threshold: "3" }); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const payload = role === "warehouse" ? { part_name: form.name, part_number: form.sku || null, quantity: Number(form.quantity), price: Number(form.price), min_threshold: Number(form.threshold) } : { part_name: form.name, part_number: form.sku || null, quantity: Number(form.quantity), price: Number(form.price) }; if (role === "warehouse") await addWarehousePart(payload); else await addPart(payload); onSaved(); } catch (err) { setError(err.response?.data?.detail || "We could not save this inventory item."); } finally { setSaving(false); } };
  return <div className="ops-modal"><form onSubmit={submit}><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button><span>Live inventory</span><h2>Add a stocked product</h2><label>Product name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Part number / SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><div><label>Quantity<input required type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label>Unit price<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label></div>{role === "warehouse" ? <label>Low-stock threshold<input required type="number" min="0" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></label> : null}{error ? <p>{error}</p> : null}<button disabled={saving}>{saving ? "Saving…" : "Add to inventory"}<ArrowRight size={16} /></button></form></div>;
}
