"use client";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Package,
  Truck,
  Wrench,
  Clock,
  Check,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  CalendarDays,
  MapPin,
  ChevronRight,
  Send,
  ShieldCheck,
  X,
  Activity,
  ShoppingBag,
  Download,
} from "lucide-react";
import {
  PageTitle,
  Stat,
  Badge,
  Modal,
  Empty,
  ProductArt,
} from "./prototype-shared";
import {
  initialRequests,
  initialInventory,
  initialOrders,
  products,
  initialAppointments,
  type Role,
} from "@/lib/demo-data";
import OperationsMessages from "./operations-messages";
import BusinessProfile from "./business-profile";
import WarehouseMarketplace from "./warehouse-marketplace";
import {
  addPart,
  addWarehousePart,
  approveMechanicRegistration,
  approveWarehouseRegistration,
  createRecordedInvoice,
  deactivateMechanic,
  deactivateOwner,
  deactivateWarehouse,
  declineMechanicRegistration,
  declineWarehouseRegistration,
  getAllMechanics,
  getAllOwners,
  getAllWarehouses,
  getAnalytics,
  getMechanicParts,
  getMyMechanicProfile,
  listRequests,
  listAppointments,
  getOpenRequests,
  getWarehouseInventory,
  getWarehouseOrders,
  resolveAlert,
  updateAppointmentStatus,
  updateMyProfile,
  updatePart,
  updateRequestStatus,
  updateWarehouseOrderGroup,
  updateWarehousePart,
} from "../../api/endpoints";

const formatStatus = (status = "") =>
  String(status)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
const mapOrders = (rows: any[]) =>
  rows.map((order) => ({
    id: order.order_ref,
    buyer: order.mechanic_name,
    warehouse: order.warehouse_name,
    items: `${order.line_count} line${order.line_count === 1 ? "" : "s"} · ${order.total_quantity} units`,
    total: Number(order.total_price || 0),
    status: formatStatus(order.status),
    serverStatus: order.status,
    date: formatDate(order.created_at),
  }));
export default function Operations({
  role,
  tab,
  setTab,
  notify,
}: {
  role: Role;
  tab: string;
  setTab: (t: string) => void;
  notify: (s: string) => void;
}) {
  const [available, setAvailable] = useState(true);
  const [jobs, setJobs] = useState([
    ...initialRequests,
    {
      id: "WM-2049",
      provider: "Sunset Auto Care",
      issue: "Flat tire near Golden Gate Park",
      vehicle: "2020 Honda Civic",
      status: "Requested",
      date: "8 minutes ago",
      mode: "Mobile service",
      mechanic: "Unassigned",
      notes: "Front passenger tire is flat. Parked safely.",
    },
  ]);
  const [inventory, setInventory] = useState(initialInventory);
  const [orders, setOrders] = useState(
    initialOrders.map((o) => ({ ...o, warehouse: "Pacific Parts Co." })),
  );
  const [modal, setModal] = useState("");
  const [billingJob, setBillingJob] = useState<(typeof jobs)[number] | null>(
    null,
  );
  const [orderId, setOrderId] = useState("PO-1084");
  const [edit, setEdit] = useState(initialInventory[0]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [alerts, setAlerts] = useState([
    {
      id: 1,
      title: "AGM battery stock is running low",
      text: "Sunset Auto Care · 3 units remaining",
      severity: "Inventory",
    },
    {
      id: 2,
      title: "A provider is waiting for approval",
      text: "Coastline Auto Service · Submitted today",
      severity: "Registration",
    },
    {
      id: 3,
      title: "Request awaiting assignment",
      text: "WM-2049 · Waiting for 8 minutes",
      severity: "Request",
    },
  ]);
  const [accounts, setAccounts] = useState([
    {
      id: 1,
      name: "Jordan Ellis",
      email: "jordan@wingman.example",
      role: "Owner",
      status: "Active",
      initials: "JE",
    },
    {
      id: 2,
      name: "Alex Morgan",
      email: "alex@wingman.example",
      role: "Mechanic",
      status: "Active",
      initials: "AM",
    },
    {
      id: 3,
      name: "Pacific Parts Co.",
      email: "parts@wingman.example",
      role: "Warehouse",
      status: "Active",
      initials: "PP",
    },
    {
      id: 4,
      name: "Coastline Auto Service",
      email: "coastline@wingman.example",
      role: "Mechanic",
      status: "Pending",
      initials: "CA",
    },
    {
      id: 5,
      name: "Valley Parts Supply",
      email: "valley@wingman.example",
      role: "Warehouse",
      status: "Pending",
      initials: "VP",
    },
  ]);
  const [chat, setChat] = useState([
    "Hi Alex, your order PO-1084 is packed and ready for the next delivery run.",
    "Perfect, thank you. Please keep the oil filters together.",
  ]);
  const [draft, setDraft] = useState("");
  const [appointments, setAppointments] = useState<any[]>(initialAppointments);
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [messageTarget, setMessageTarget] = useState<any>(null);
  useEffect(() => {
    setFilter("All");
    setSearch("");
  }, [tab]);
  useEffect(() => {
    if (role !== "mechanic" || !localStorage.getItem("token")) return;
    let active = true;
    Promise.all([
      listRequests(),
      getOpenRequests({ lat: 37.7749, lng: -122.4194, radius_km: 1000 }),
    ])
      .then(([assigned, open]) => {
        if (!active) return;
        const seen = new Set<string>();
        const rows = [...(assigned.data || []), ...(open.data || [])].filter(
          (item: any) => !seen.has(item.id) && seen.add(item.id),
        );
        setJobs(
          rows.map((item: any) => ({
            id: item.request_ref || item.id,
            backendId: item.id,
            ownerId: item.owner_id,
            provider: item.mechanic_name || "Wingman provider",
            issue: item.problem_desc,
            vehicle: item.vehicle_label || "Vehicle",
            status: String(item.status)
              .split("_")
              .map((part: string) => part[0].toUpperCase() + part.slice(1))
              .join(" "),
            serverStatus: item.status,
            date: new Intl.DateTimeFormat(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(item.created_at)),
            mode: "Service request",
            mechanic: item.mechanic_name || "Unassigned",
            notes:
              item.owner_address || "Owner location shared with this request.",
          })),
        );
      })
      .catch(() => notify("Live jobs could not be refreshed."))
      .finally(() => {});
    return () => {
      active = false;
    };
  }, [role, notify, tab]);
  useEffect(() => {
    if (role !== "mechanic" || !localStorage.getItem("token")) return;
    jobs.forEach((job: any) => {
      if (!job.backendId || !job.serverStatus) return;
      const next = String(job.status).toLowerCase().replace(/ /g, "_");
      if (next === job.serverStatus) return;
      updateRequestStatus(job.backendId, { status: next })
        .then(() =>
          setJobs((current) =>
            current.map((item: any) =>
              item.backendId === job.backendId
                ? { ...item, serverStatus: next }
                : item,
            ),
          ),
        )
        .catch((error: any) => {
          notify(
            error?.response?.data?.detail ||
              "The job status could not be updated.",
          );
          setJobs((current) =>
            current.map((item: any) =>
              item.backendId === job.backendId
                ? {
                    ...item,
                    status: String(job.serverStatus)
                      .split("_")
                      .map(
                        (part: string) => part[0].toUpperCase() + part.slice(1),
                      )
                      .join(" "),
                  }
                : item,
            ),
          );
        });
    });
  }, [jobs, role, notify]);
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    let active = true;
    async function loadRoleData() {
      try {
        if (role === "mechanic") {
          const [profileResponse, appointmentResponse, orderResponse] =
            await Promise.all([
              getMyMechanicProfile(),
              listAppointments(),
              getWarehouseOrders(),
            ]);
          const partsResponse = await getMechanicParts(profileResponse.data.mechanic_id);
          if (!active) return;
          setAvailable(Boolean(profileResponse.data.is_available));
          setInventory(
            (partsResponse.data || []).map((part: any) => ({
              id: part.id,
              name: part.part_name,
              sku: part.part_number || "—",
              category: "Parts",
              unit: "Per unit",
              quantity: part.quantity,
              price: Number(part.price),
              color: "#dbe7ff",
              minThreshold: part.min_threshold,
            })) as any,
          );
          setAppointments(appointmentResponse.data || []);
          setOrders(mapOrders(orderResponse.data || []) as any);
        } else if (role === "warehouse") {
          const [inventoryResponse, orderResponse] = await Promise.all([
            getWarehouseInventory(),
            getWarehouseOrders(),
          ]);
          if (!active) return;
          setInventory(
            (inventoryResponse.data || []).map((part: any) => ({
              id: part.id,
              name: part.part_name,
              sku: part.part_number || "—",
              category: part.manufacturer || "Parts",
              unit: part.lead_time_label || "Per unit",
              quantity: part.quantity,
              price: Number(part.price),
              color: "#dbe7ff",
              minThreshold: part.min_threshold,
            })) as any,
          );
          setOrders(mapOrders(orderResponse.data || []) as any);
        } else if (role === "admin") {
          const [analyticsResponse, mechanicsResponse, warehousesResponse, ownersResponse] =
            await Promise.all([
              getAnalytics({ range: "month" }),
              getAllMechanics(),
              getAllWarehouses(),
              getAllOwners(),
            ]);
          if (!active) return;
          setAnalytics(analyticsResponse.data);
          const combined = [
            ...(ownersResponse.data || []).map((item: any) => ({ ...item, role: "Owner", profileId: item.id })),
            ...(mechanicsResponse.data || []).map((item: any) => ({ ...item, role: "Mechanic", profileId: item.id, status: item.approval_status })),
            ...(warehousesResponse.data || []).map((item: any) => ({ ...item, role: "Warehouse", profileId: item.id, status: item.approval_status })),
          ];
          setAccounts(
            combined.map((item: any) => ({
              ...item,
              id: item.profileId,
              status: item.status === "pending" ? "Pending" : item.is_active === false ? "Inactive" : "Active",
              initials: String(item.name || item.warehouse_name || "W")
                .split(/\s+/)
                .slice(0, 2)
                .map((part: string) => part[0])
                .join("")
                .toUpperCase(),
            })) as any,
          );
          setAlerts(
            (analyticsResponse.data?.unresolved_alerts || []).map((item: any) => ({
              id: item.id,
              title: item.message,
              text: `${item.mechanic_name || "Network"} · ${item.part_name || "System"}`,
              severity: item.alert_type || "Network",
            })) as any,
          );
          setJobs(
            (analyticsResponse.data?.latest_requests || []).map((item: any) => ({
              id: item.request_ref,
              backendId: item.id,
              provider: item.mechanic_name,
              issue: item.problem_desc,
              vehicle: item.owner_name,
              status: formatStatus(item.status),
              date: formatDate(item.created_at),
              mode: "Service request",
              mechanic: item.mechanic_name,
              notes: "Network request",
            })) as any,
          );
        }
      } catch (error: any) {
        if (active) notify(error?.response?.data?.detail || "Workspace data could not be refreshed.");
      }
    }
    loadRoleData();
    return () => {
      active = false;
    };
  }, [role, tab, notify]);
  const isAdmin = role === "admin",
    isWarehouse = role === "warehouse";
  const goJobs = () => setTab(isWarehouse ? "Orders" : "Jobs");
  async function nextOrder(id: string) {
    const order: any = orders.find((item) => item.id === id);
    const transitions: Record<string, string> = {
      Placed: "accepted",
      Requested: "accepted",
      Confirmed: "packed",
      Accepted: "packed",
      Packed: "shipped",
      Shipped: "delivered",
    };
    const nextStatus = order ? transitions[order.status] : "";
    if (!order || !nextStatus) return;
    try {
      if (localStorage.getItem("token")) {
        await updateWarehouseOrderGroup(id, { status: nextStatus });
      }
      setOrders(
        orders.map((item) =>
          item.id === id
            ? { ...item, status: formatStatus(nextStatus), serverStatus: nextStatus }
            : item,
        ),
      );
      notify("Order status updated.");
    } catch (error: any) {
      notify(error?.response?.data?.detail || "Order status could not be updated.");
    }
  }
  return (
    <>
      {tab === "Overview" && (
        <>
          <PageTitle
            title="Overview"
            action={
              isAdmin ? (
                <Badge>California · Demonstration</Badge>
              ) : (
                <button
                  className={"availability-toggle " + (available ? "on" : "")}
                  onClick={async () => {
                    const next = !available;
                    try {
                      if (role === "mechanic" && localStorage.getItem("token")) {
                        await updateMyProfile({ is_available: next });
                      }
                      setAvailable(next);
                      notify(
                        next
                          ? `You are accepting new ${isWarehouse ? "orders" : "jobs"}.`
                          : "Availability paused.",
                      );
                    } catch (error: any) {
                      notify(error?.response?.data?.detail || "Availability could not be updated.");
                    }
                  }}
                >
                  <span />
                  {available
                    ? "Accepting new " + (isWarehouse ? "orders" : "jobs")
                    : "Currently unavailable"}
                </button>
              )
            }
          />
          <div className="stat-grid">
            {isAdmin ? (
              <>
                <Stat
                  label="Total accounts"
                  value="248"
                  change="Across 4 role workspaces"
                  icon={<Users size={19} />}
                />
                <Stat
                  label="Active requests"
                  value="18"
                  change="6 currently in progress"
                  icon={<Wrench size={19} />}
                />
                <Stat
                  label="Provider approvals"
                  value={String(
                    accounts.filter((a) => a.status === "Pending").length,
                  )}
                  change="Ready for your review"
                  icon={<ShieldCheck size={19} />}
                />
                <Stat
                  label="Open alerts"
                  value={String(alerts.length)}
                  change="Keep the network healthy"
                  icon={<AlertTriangle size={19} />}
                />
              </>
            ) : isWarehouse ? (
              <>
                <Stat
                  label="Open orders"
                  value={String(
                    orders.filter((o) => o.status !== "Delivered").length,
                  )}
                  change="Ready to keep moving"
                  icon={<ShoppingBag size={19} />}
                />
                <Stat
                  label="Products in stock"
                  value="126"
                  change="Across 8 categories"
                  icon={<Package size={19} />}
                />
                <Stat
                  label="Low-stock items"
                  value={String(inventory.filter((p) => p.quantity < 5).length)}
                  change="A little restock needed"
                  icon={<AlertTriangle size={19} />}
                />
                <Stat
                  label="Delivered this week"
                  value="24"
                  change="8 more than last week"
                  icon={<Truck size={19} />}
                />
              </>
            ) : (
              <>
                <Stat
                  label="Today’s jobs"
                  value="4"
                  change="2 completed · 1 in progress"
                  icon={<Wrench size={19} />}
                />
                <Stat
                  label="New requests"
                  value={String(
                    jobs.filter((j) => j.status === "Requested").length,
                  )}
                  change="One more person to help"
                  icon={<MapPin size={19} />}
                />
                <Stat
                  label="Upcoming visits"
                  value="3"
                  change="Next at 1:30 PM"
                  icon={<CalendarDays size={19} />}
                />
                <Stat
                  label="Low-stock parts"
                  value={String(inventory.filter((p) => p.quantity < 5).length)}
                  change="Keep your shelf ready"
                  icon={<Package size={19} />}
                />
              </>
            )}
          </div>
          <div className="operations-layout">
            <section>
              <div className="panel section-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      {isAdmin
                        ? "Activity across the network"
                        : isWarehouse
                          ? "Orders in motion"
                          : "Your work, in motion"}
                    </h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => (isAdmin ? setTab("Analytics") : goJobs())}
                  >
                    View all <ArrowUpRight size={15} />
                  </button>
                </div>
                {isAdmin ? (
                  <div className="activity-chart">
                    <div className="chart-legend">
                      <span />
                      Service requests <i />
                      Completed jobs
                    </div>
                    <div className="chart-bars">
                      {[42, 65, 51, 78, 58, 89, 72].map((n, i) => (
                        <div key={i}>
                          <div className="bar-pair">
                            <span style={{ height: n + "%" }} />
                            <span style={{ height: n - 15 + "%" }} />
                          </div>
                          <small>
                            {
                              ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"][
                                i
                              ]
                            }
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : isWarehouse ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ORDER</th>
                          <th>MECHANIC</th>
                          <th>STATUS</th>
                          <th>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => {
                              setOrderId(o.id);
                              setModal("order-detail");
                            }}
                            className="click-row"
                          >
                            <td>
                              <strong>{o.id}</strong>
                              <small>{o.date}</small>
                            </td>
                            <td>{o.buyer}</td>
                            <td>
                              <Badge
                                tone={
                                  o.status === "Delivered" ? "gray" : "green"
                                }
                              >
                                {o.status}
                              </Badge>
                            </td>
                            <td>${o.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  jobs
                    .filter((j) => j.status !== "Completed")
                    .map((j) => (
                      <div className="work-item" key={j.id}>
                        <span className="work-icon">
                          <Wrench size={20} />
                        </span>
                        <div>
                          <div className="between">
                            <h3>{j.issue}</h3>
                            <Badge
                              tone={
                                j.status === "Requested" ? "amber" : "green"
                              }
                            >
                              {j.status}
                            </Badge>
                          </div>
                          <p>
                            {j.vehicle} · {j.mode}
                          </p>
                          <small>
                            {j.id} · {j.date}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="View job"
                          onClick={() => setTab("Jobs")}
                        >
                          <ArrowUpRight size={20} />
                        </button>
                      </div>
                    ))
                )}
              </div>
              <div className="panel section-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      {isAdmin
                        ? "Recent network activity"
                        : isWarehouse
                          ? "Your delivery rhythm"
                          : "Coming up today"}
                    </h2>
                  </div>
                  <Clock size={20} />
                </div>
                {(isAdmin
                  ? [
                      [
                        "10:42 AM",
                        "Request WM-2048 moved to in progress",
                        "Sunset Auto Care · San Francisco",
                      ],
                      [
                        "10:30 AM",
                        "Parts order PO-1084 packed",
                        "Pacific Parts Co. · Oakland",
                      ],
                      [
                        "10:18 AM",
                        "New provider registration received",
                        "Coastline Auto Service · Santa Cruz",
                      ],
                    ]
                  : isWarehouse
                    ? [
                        [
                          "10:00 AM",
                          "Morning orders packed",
                          "4 orders · Bay Area delivery route",
                        ],
                        [
                          "1:30 PM",
                          "Afternoon delivery pickup",
                          "3 orders · San Francisco + Oakland",
                        ],
                        [
                          "4:00 PM",
                          "Inventory reconciliation",
                          "Review low-stock essentials",
                        ],
                      ]
                    : [
                        [
                          "11:30 AM",
                          "Finish battery replacement",
                          "Jordan Ellis · 2021 Toyota RAV4",
                        ],
                        [
                          "1:30 PM",
                          "Oil change & safety check",
                          "Sam Rivera · 2020 Honda CR-V",
                        ],
                        [
                          "3:00 PM",
                          "Brake inspection",
                          "Taylor Kim · 2019 Mazda CX-5",
                        ],
                      ]
                ).map(([time, title, desc]) => (
                  <div className="schedule-row" key={time}>
                    <span>{time}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </div>
                    <span className="schedule-dot" />
                  </div>
                ))}
              </div>
            </section>
            <aside>
              <div className="operations-banner">
                <span className="icon-disc">
                  {isAdmin ? (
                    <ShieldCheck size={24} />
                  ) : isWarehouse ? (
                    <Truck size={24} />
                  ) : (
                    <Wrench size={24} />
                  )}
                </span>
                <h2>{isAdmin ? "Provider approvals" : "Low-stock parts"}</h2>
                <button
                  className="secondary full"
                  onClick={() => setTab(isAdmin ? "Approvals" : "Inventory")}
                >
                  {isAdmin ? "Review providers" : "Review inventory"}
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="panel section-panel">
                <div className="section-heading">
                  <h3>
                    {isAdmin ? "Needs a little attention" : "Shelf check"}
                  </h3>
                  <span className="count-badge">
                    {isAdmin ? alerts.length : 2}
                  </span>
                </div>
                {isAdmin
                  ? alerts.slice(0, 3).map((a) => (
                      <div className="mini-alert" key={a.id}>
                        <AlertTriangle size={17} />
                        <div>
                          <strong>{a.title}</strong>
                          <small>{a.text}</small>
                        </div>
                      </div>
                    ))
                  : inventory
                      .filter((p) => p.quantity < 5)
                      .map((p) => (
                        <div className="mini-alert" key={p.id}>
                          <Package size={18} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {p.quantity} left · Restock recommended
                            </small>
                          </div>
                        </div>
                      ))}
              </div>
            </aside>
          </div>
        </>
      )}
      {tab === "Jobs" && (
        <>
          <PageTitle
            title="Jobs"
            action={
              <Badge>
                {available
                  ? "Available for requests"
                  : "Not accepting requests"}
              </Badge>
            }
          />
          <div className="filter-row">
            {["All", "Requested", "Accepted", "In progress", "Completed"].map(
              (s) => (
                <button
                  key={s}
                  className={"chip " + (filter === s ? "selected" : "")}
                  onClick={() => setFilter(s)}
                >
                  {s}
                </button>
              ),
            )}
          </div>
          <div className="request-grid">
            {jobs
              .filter((j) => filter === "All" || j.status === filter)
              .map((j) => (
                <article className="panel request-card" key={j.id}>
                  <div className="between">
                    <span className="overline">{j.id}</span>
                    <Badge
                      tone={
                        j.status === "Requested"
                          ? "amber"
                          : j.status === "Completed"
                            ? "gray"
                            : "green"
                      }
                    >
                      {j.status}
                    </Badge>
                  </div>
                  <h2>{j.issue}</h2>
                  <p className="muted">{j.vehicle}</p>
                  <div className="detail-box">
                    <MapPin size={20} />
                    <div>
                      <strong>{j.mode} · 1.2 miles away</strong>
                      <p>{j.notes}</p>
                    </div>
                  </div>
                  <div className="job-person">
                    <span className="avatar">JE</span>
                    <div>
                      <strong>Jordan Ellis</strong>
                      <small>Vehicle owner · {j.date}</small>
                    </div>
                  </div>
                  <div className="button-row">
                    {j.status !== "Completed" && (
                      <button
                        className="primary"
                        onClick={() => {
                          if (j.status === "In progress") {
                            setBillingJob(j);
                            setModal("complete-job");
                            return;
                          }
                          setJobs(
                            jobs.map((x) =>
                              x.id === j.id
                                ? {
                                    ...x,
                                    status:
                                      j.status === "Requested"
                                        ? "Accepted"
                                        : "In progress",
                                  }
                                : x,
                            ),
                          );
                          notify("Job status updated.");
                        }}
                      >
                        {j.status === "Requested"
                          ? "Accept request"
                          : j.status === "Accepted"
                            ? "Begin work"
                            : "Complete job"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => {
                        setMessageTarget({
                          ownerId: (j as any).ownerId,
                          requestId: (j as any).backendId,
                          name: "Jordan Ellis",
                          store: "Vehicle owner",
                          job: j.id,
                        });
                        setTab("Messages");
                      }}
                    >
                      Message owner
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </>
      )}
      {tab === "Inventory" && (
        <>
          <PageTitle
            title="Inventory"
            action={
              <button
                className="primary"
                onClick={() => setModal("add-product")}
              >
                <Plus size={17} /> Add inventory
              </button>
            }
          />
          <div className="inventory-summary">
            <Badge>{inventory.length} products</Badge>
            <Badge tone="amber">
              {inventory.filter((p) => p.quantity < 5).length} running low
            </Badge>
            <span>Illustrative stock levels</span>
          </div>
          <div className="panel">
            <div className="table-toolbar">
              <div className="search-input">
                <Search size={17} />
                <input
                  placeholder="Find a part or SKU…"
                  aria-label="Search inventory"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="secondary"
                onClick={() => {
                  setFilter(filter === "Low stock" ? "All" : "Low stock");
                }}
              >
                {filter === "Low stock"
                  ? "Show all inventory"
                  : "Low stock only"}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>CATEGORY</th>
                    <th>UNIT PRICE</th>
                    <th>IN STOCK</th>
                    <th>STATUS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inventory
                    .filter(
                      (p) =>
                        (p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.sku.toLowerCase().includes(search.toLowerCase())) &&
                        (filter !== "Low stock" || p.quantity < 5),
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="table-product">
                            <span
                              className="table-product-art"
                              style={{ background: p.color }}
                            >
                              <Package size={22} />
                            </span>
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.unit}</small>
                            </div>
                          </div>
                        </td>
                        <td className="muted">{p.sku}</td>
                        <td>{p.category}</td>
                        <td>${p.price.toFixed(2)}</td>
                        <td>
                          <strong>{p.quantity}</strong> units
                        </td>
                        <td>
                          <Badge tone={p.quantity < 5 ? "amber" : "green"}>
                            {p.quantity < 5 ? "Low stock" : "In stock"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setEdit(p);
                              setModal("edit-stock");
                            }}
                          >
                            Update <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          {!isWarehouse && (
            <div className="care-banner">
              <Package size={30} />
              <div>
                <h3>Warehouse parts</h3>
              </div>
              <button
                className="secondary"
                onClick={() => setTab("Parts marketplace")}
              >
                Find parts <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {tab === "Orders" && (
        <>
          <PageTitle
            title="Orders"
            action={
              !isWarehouse ? (
                <button
                  className="primary"
                  onClick={() => setTab("Parts marketplace")}
                >
                  <Plus size={17} /> Order parts
                </button>
              ) : undefined
            }
          />
          <div className="filter-row">
            {[
              "All",
              "Placed",
              "Confirmed",
              "Packed",
              "Shipped",
              "Delivered",
            ].map((s) => (
              <button
                className={"chip " + (filter === s ? "selected" : "")}
                key={s}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>{isWarehouse ? "CUSTOMER" : "WAREHOUSE"}</th>
                  <th>ITEMS</th>
                  <th>TOTAL</th>
                  <th>STATUS</th>
                  <th>NEXT STEP</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((o) => filter === "All" || o.status === filter)
                  .map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.id}</strong>
                        <small>{o.date}</small>
                      </td>
                      <td>{isWarehouse ? o.buyer : o.warehouse}</td>
                      <td>{o.items}</td>
                      <td>${o.total.toFixed(2)}</td>
                      <td>
                        <Badge
                          tone={o.status === "Delivered" ? "gray" : "green"}
                        >
                          {o.status}
                        </Badge>
                      </td>
                      <td>
                        {o.status === "Delivered" ? (
                          <span className="muted">All delivered</span>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() =>
                              isWarehouse
                                ? nextOrder(o.id)
                                : (setOrderId(o.id), setModal("order-detail"))
                            }
                          >
                            {isWarehouse
                              ? (
                                  {
                                    Placed: "Confirm order",
                                    Confirmed: "Mark packed",
                                    Packed: "Mark shipped",
                                    Shipped: "Mark delivered",
                                  } as Record<string, string>
                                )[o.status]
                              : "Track order"}{" "}
                            <ArrowRight size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div hidden={tab !== "Parts marketplace"}>
        <PageTitle title="Parts marketplace" />
        <WarehouseMarketplace
          onOrder={(warehouse, item, quantity, total, order) => {
            setOrders([
              {
                id: order?.order_ref || "PO-" + Date.now().toString().slice(-6),
                buyer: "Sunset Auto Care",
                warehouse,
                items: `${item} × ${quantity}`,
                total,
                status: formatStatus(order?.status || "requested"),
                serverStatus: order?.status || "requested",
                date: "Just now",
              },
              ...orders,
            ] as any);
            notify("Warehouse order placed.");
            setTab("Orders");
          }}
        />
      </div>
      {tab === "Appointments" && (
        <>
          <PageTitle title="Appointments" />
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>WHEN</th>
                  <th>SERVICE</th>
                  <th>VEHICLE</th>
                  <th>OWNER</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{
                        a.scheduled_for
                          ? new Intl.DateTimeFormat(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(new Date(a.scheduled_for))
                          : a.date
                      }</strong>
                      <small>{
                        a.scheduled_for
                          ? new Intl.DateTimeFormat(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(a.scheduled_for))
                          : a.time
                      }</small>
                    </td>
                    <td>{a.service_type || a.service}</td>
                    <td>{a.vehicle_label || a.vehicle || "Vehicle"}</td>
                    <td>{a.owner_name || "Vehicle owner"}</td>
                    <td>
                      <Badge>{formatStatus(a.status)}</Badge>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelectedAppointment(a);
                          setModal("appointment-detail");
                        }}
                      >
                        Manage <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div hidden={tab !== "Messages"}>
        <PageTitle title="Messages" />
        {(role === "mechanic" || role === "warehouse") && (
          <OperationsMessages role={role} target={messageTarget} />
        )}
      </div>
      <div hidden={tab !== "Profile"}>
        <PageTitle title="Business profile" />
        <BusinessProfile warehouse={isWarehouse} notify={notify} />
      </div>
      {tab === "Approvals" && (
        <>
          <PageTitle title="Approvals" />
          <div className="request-grid">
            {accounts
              .filter((a) => a.status === "Pending")
              .map((a) => (
                <article className="panel approval-card" key={a.id}>
                  <div className="between">
                    <span className="provider-avatar">{a.initials}</span>
                    <Badge tone="amber">Pending review</Badge>
                  </div>
                  <h2>{a.name}</h2>
                  <p>{a.role} · California</p>
                  <div className="detail-box">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>Profile ready for review</strong>
                      <p>
                        {a.email}
                        <br />
                        Submitted September 17, 2026
                      </p>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="primary"
                      onClick={async () => {
                        try {
                          if (a.role === "Mechanic") await approveMechanicRegistration(String(a.id));
                          else await approveWarehouseRegistration(String(a.id));
                          setAccounts(
                            accounts.map((x) =>
                              x.id === a.id ? { ...x, status: "Active" } : x,
                            ),
                          );
                          notify("Provider approved.");
                        } catch (error: any) {
                          notify(error?.response?.data?.detail || "Provider could not be approved.");
                        }
                      }}
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          if (a.role === "Mechanic") await declineMechanicRegistration(String(a.id));
                          else await declineWarehouseRegistration(String(a.id));
                          setAccounts(
                            accounts.map((x) =>
                              x.id === a.id ? { ...x, status: "Declined" } : x,
                            ),
                          );
                          notify("Registration declined.");
                        } catch (error: any) {
                          notify(error?.response?.data?.detail || "Registration could not be declined.");
                        }
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            {accounts.every((a) => a.status !== "Pending") && (
              <Empty
                title="All caught up"
                text="There are no more sample registrations to review."
              />
            )}
          </div>
        </>
      )}
      {tab === "Users" && (
        <>
          <PageTitle title="Users" />
          <div className="panel">
            <div className="table-toolbar">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Search users"
                  placeholder="Search names or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Badge>{accounts.length} accounts</Badge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ACCOUNT</th>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts
                    .filter((a) =>
                      (a.name + a.email)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="table-product">
                            <span className="avatar">{a.initials}</span>
                            <strong>{a.name}</strong>
                          </div>
                        </td>
                        <td>{a.email}</td>
                        <td>{a.role}</td>
                        <td>
                          <Badge
                            tone={
                              a.status === "Active"
                                ? "green"
                                : a.status === "Pending"
                                  ? "amber"
                                  : "gray"
                            }
                          >
                            {a.status}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            disabled={a.status !== "Active"}
                            onClick={async () => {
                              try {
                                if (a.role === "Mechanic") await deactivateMechanic(String(a.id));
                                else if (a.role === "Warehouse") await deactivateWarehouse(String(a.id));
                                else await deactivateOwner(String(a.id));
                                setAccounts(
                                  accounts.map((x) =>
                                    x.id === a.id ? { ...x, status: "Inactive" } : x,
                                  ),
                                );
                                notify("Account deactivated.");
                              } catch (error: any) {
                                notify(error?.response?.data?.detail || "Account could not be deactivated.");
                              }
                            }}
                          >
                            {a.status === "Active" ? "Deactivate" : a.status}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {tab === "Alerts" && (
        <>
          <PageTitle title="Alerts" />
          <div className="panel section-panel">
            {alerts.map((a) => (
              <div className="alert-row" key={a.id}>
                <span className="alert-icon">
                  <AlertTriangle size={21} />
                </span>
                <div>
                  <Badge tone="amber">{a.severity}</Badge>
                  <h3>{a.title}</h3>
                  <p>{a.text}</p>
                </div>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await resolveAlert(String(a.id));
                      setAlerts(alerts.filter((x) => x.id !== a.id));
                      notify("Alert resolved.");
                    } catch (error: any) {
                      notify(error?.response?.data?.detail || "Alert could not be resolved.");
                    }
                  }}
                >
                  <Check size={16} /> Resolve
                </button>
              </div>
            ))}
            {!alerts.length && (
              <Empty
                title="A clear road ahead"
                text="All sample alerts have been resolved."
              />
            )}
          </div>
        </>
      )}
      {tab === "Analytics" && (
        <>
          <PageTitle title="Analytics" />
          <div className="stat-grid">
            <Stat
              label="Completed services"
              value={String(analytics?.summary?.completed ?? 0)}
              change={`${analytics?.summary?.active ?? 0} active requests`}
              icon={<CheckCircle2 size={19} />}
            />
            <Stat
              label="Parts orders"
              value={String(analytics?.top_parts?.reduce((sum: number, item: any) => sum + Number(item.times_used || 0), 0) ?? 0)}
              change="Parts used in completed work"
              icon={<Package size={19} />}
            />
            <Stat
              label="Recorded revenue"
              value={`$${Number(analytics?.summary?.total_revenue || 0).toFixed(2)}`}
              change={`$${Number(analytics?.summary?.avg_job_value || 0).toFixed(2)} average job`}
              icon={<TrendingUp size={19} />}
            />
            <Stat
              label="Active providers"
              value={String(analytics?.mechanics_online ?? 0)}
              change="Mechanics currently available"
              icon={<Users size={19} />}
            />
          </div>
          <div className="analytics-grid">
            <div className="panel section-panel">
              <div className="section-heading">
                <div>
                  <h2>Service activity</h2>
                  <p>Requests and completed services · Selected period</p>
                </div>
                <Badge>Live records</Badge>
              </div>
              <div className="activity-chart">
                <div className="chart-legend">
                  <span />
                  Requests <i />
                  Completed
                </div>
                <div className="chart-bars">
                  {[50, 65, 48, 78, 59, 90, 74].map((n, i) => (
                    <div key={i}>
                      <div className="bar-pair">
                        <span style={{ height: n + "%" }} />
                        <span style={{ height: n - 12 + "%" }} />
                      </div>
                      <small>
                        {["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"][i]}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel section-panel">
              <h2>What brings people here</h2>
              <p className="muted">Service mix · This month</p>
              <div className="donut-chart">
                <div>
                  <strong>184</strong>
                  <span>services</span>
                </div>
              </div>
              <div className="donut-legend">
                {[
                  ["Routine care", "42%"],
                  ["Roadside help", "28%"],
                  ["Tire service", "18%"],
                  ["Other repairs", "12%"],
                ].map(([s, n], i) => (
                  <div key={s}>
                    <span
                      style={{
                        background: [
                          "#244d3e",
                          "#8ca67b",
                          "#d8eb9d",
                          "#e8eade",
                        ][i],
                      }}
                    />
                    {s}
                    <strong>{n}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {tab === "Requests" && (
        <>
          <PageTitle title="Requests" />
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>REQUEST</th>
                  <th>ISSUE</th>
                  <th>VEHICLE</th>
                  <th>PROVIDER</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong>{j.id}</strong>
                      <small>{j.date}</small>
                    </td>
                    <td>{j.issue}</td>
                    <td>{j.vehicle}</td>
                    <td>{j.provider}</td>
                    <td>
                      <Badge
                        tone={j.status === "Requested" ? "amber" : "green"}
                      >
                        {j.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {modal === "edit-stock" && (
        <Modal
          title="Keep your shelf up to date."
          subtitle={edit.name}
          onClose={() => setModal("")}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const changes = {
                quantity: Number(d.get("quantity")),
                price: Number(d.get("price")),
              };
              try {
                if (localStorage.getItem("token")) {
                  if (isWarehouse) await updateWarehousePart(String(edit.id), changes);
                  else await updatePart(String(edit.id), changes);
                }
                setInventory(
                  inventory.map((p) =>
                    p.id === edit.id ? { ...p, ...changes } : p,
                  ),
                );
                setModal("");
                notify("Stock updated.");
              } catch (error: any) {
                notify(error?.response?.data?.detail || "Stock could not be updated.");
              }
            }}
          >
            <label>
              Quantity on hand
              <input
                name="quantity"
                type="number"
                min={0}
                required
                defaultValue={edit.quantity}
              />
            </label>
            <label>
              Unit price ($)
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={edit.price}
              />
            </label>
            <button className="primary full">
              Save inventory <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "add-product" && (
        <Modal
          title="Make room for a new essential."
          onClose={() => setModal("")}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const payload = {
                part_name: String(d.get("name")),
                part_number: String(d.get("sku")),
                quantity: Number(d.get("quantity")),
                min_threshold: 2,
                price: Number(d.get("price")),
                compatible_vehicles: [],
              };
              try {
                const response = localStorage.getItem("token")
                  ? isWarehouse
                    ? await addWarehousePart(payload)
                    : await addPart(payload)
                  : { data: { id: Date.now(), ...payload } };
                const product = response.data;
                setInventory([
                  ...inventory,
                  {
                    ...initialInventory[0],
                    id: product.id,
                    name: product.part_name,
                    sku: product.part_number || "—",
                    quantity: product.quantity,
                    price: Number(product.price),
                  },
                ] as any);
                setModal("");
                notify("Product added to inventory.");
              } catch (error: any) {
                notify(error?.response?.data?.detail || "Product could not be added.");
              }
            }}
          >
            <label>
              Product name
              <input name="name" required />
            </label>
            <label>
              SKU
              <input name="sku" required />
            </label>
            <div className="form-columns">
              <label>
                Quantity
                <input name="quantity" type="number" min={0} required />
              </label>
              <label>
                Unit price ($)
                <input
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                />
              </label>
            </div>
            <button className="primary">
              Add inventory <Plus size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "order-detail" && (
        <Modal
          title={"Order " + orderId}
          subtitle={orders.find((o) => o.id === orderId)?.warehouse}
          onClose={() => setModal("")}
        >
          <p>{orders.find((o) => o.id === orderId)?.items}</p>
          <Badge>{orders.find((o) => o.id === orderId)?.status}</Badge>
          <p>
            Demo total: $
            {orders.find((o) => o.id === orderId)?.total.toFixed(2)}
          </p>
          <button
            className="primary full"
            onClick={() => {
              setModal("");
              setTab("Messages");
            }}
          >
            Messages <Send size={17} />
          </button>
        </Modal>
      )}
      {modal === "appointment-detail" && selectedAppointment && (
        <Modal
          title={selectedAppointment.service_type || selectedAppointment.service}
          subtitle={`${selectedAppointment.owner_name || "Vehicle owner"} · ${selectedAppointment.scheduled_for ? formatDate(selectedAppointment.scheduled_for) : `${selectedAppointment.date} · ${selectedAppointment.time}`}`}
          onClose={() => {
            setSelectedAppointment(null);
            setModal("");
          }}
        >
          <div className="detail-box">
            <CalendarDays size={24} />
            <div>
              <strong>{selectedAppointment.vehicle_label || selectedAppointment.vehicle || "Vehicle"}</strong>
              <p>{selectedAppointment.notes || "No additional appointment notes."}</p>
            </div>
          </div>
          <div className="button-row">
            <button
              className="primary"
              onClick={async () => {
                try {
                  if (localStorage.getItem("token") && selectedAppointment.id) {
                    await updateAppointmentStatus(selectedAppointment.id, { status: "confirmed" });
                  }
                  setAppointments((current) =>
                    current.map((item) =>
                      item.id === selectedAppointment.id
                        ? { ...item, status: "confirmed" }
                        : item,
                    ),
                  );
                  notify("Appointment confirmed.");
                  setSelectedAppointment(null);
                  setModal("");
                } catch (error: any) {
                  notify(error?.response?.data?.detail || "Appointment could not be confirmed.");
                }
              }}
            >
              Confirm appointment <Check size={16} />
            </button>
            <button
              className="secondary"
              onClick={() => {
                setMessageTarget({
                  ownerId: selectedAppointment.owner_id,
                  name: selectedAppointment.owner_name,
                  store: "Vehicle owner",
                  job: selectedAppointment.service_type,
                });
                setModal("");
                setTab("Messages");
              }}
            >
              Message owner
            </button>
          </div>
        </Modal>
      )}
      {modal === "complete-job" && billingJob && (
        <Modal
          title="Complete job and record bill"
          subtitle={`${billingJob.id} · ${billingJob.vehicle}`}
          onClose={() => {
            setModal("");
            setBillingJob(null);
          }}
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget,
                button = form.querySelector(
                  'button[type="submit"]',
                ) as HTMLButtonElement | null,
                data = new FormData(form);
              if (button) button.disabled = true;
              const labor = Number(data.get("labor")),
                partsCost = Number(data.get("parts")),
                fees = Number(data.get("fees") || 0),
                description = String(data.get("description")),
                note = String(data.get("note") || "");
              try {
                if (
                  localStorage.getItem("token") &&
                  (billingJob as any).backendId
                ) {
                  await createRecordedInvoice({
                    owner_id: (billingJob as any).ownerId,
                    provider_name:
                      (billingJob as any).provider || "Wingman mechanic",
                    request_id: (billingJob as any).backendId,
                    taxes_and_fees: fees,
                    provider_note: note,
                    items: [
                      {
                        description: `${description} · labor`,
                        quantity: 1,
                        unit_price: labor,
                      },
                      {
                        description: "Parts",
                        quantity: 1,
                        unit_price: partsCost,
                      },
                    ],
                  });
                  await updateRequestStatus((billingJob as any).backendId, {
                    status: "completed",
                    final_cost: labor + partsCost + fees,
                  });
                  setJobs((current) =>
                    current.map((job: any) =>
                      job.id === billingJob.id
                        ? {
                            ...job,
                            status: "Completed",
                            serverStatus: "completed",
                            notes: `${description}. Final recorded bill: $${(labor + partsCost + fees).toFixed(2)}.`,
                          }
                        : job,
                    ),
                  );
                  notify(
                    "Job completed and the recorded bill is now visible to the owner.",
                  );
                } else {
                  const invoice = {
                    reference: `INV-${billingJob.id}`,
                    requestId: billingJob.id,
                    description,
                    labor,
                    parts: partsCost,
                    fees,
                    note,
                    createdAt: new Date().toISOString(),
                  };
                  const saved = JSON.parse(
                    localStorage.getItem("wingman-recorded-invoices") || "[]",
                  );
                  localStorage.setItem(
                    "wingman-recorded-invoices",
                    JSON.stringify([invoice, ...saved]),
                  );
                  setJobs(
                    jobs.map((job) =>
                      job.id === billingJob.id
                        ? {
                            ...job,
                            status: "Completed",
                            notes: `${description}. Final recorded bill: $${(labor + partsCost + fees).toFixed(2)}.`,
                          }
                        : job,
                    ),
                  );
                  notify("Sample job completed.");
                }
                setModal("");
                setBillingJob(null);
              } catch (error: any) {
                notify(
                  error?.response?.data?.detail ||
                    "The job could not be completed.",
                );
              } finally {
                if (button) button.disabled = false;
              }
            }}
          >
            <p className="muted">
              A recorded bill is required to complete the job. Wingman records
              it for the owner; no payment is processed.
            </p>
            <label>
              Work completed
              <input
                name="description"
                required
                placeholder="Describe the completed repair"
              />
            </label>
            <div className="form-columns">
              <label>
                Labor ($)
                <input
                  name="labor"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Parts ($)
                <input
                  name="parts"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
            </div>
            <label>
              Taxes and fees ($)
              <input
                name="fees"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </label>
            <label>
              Owner note
              <textarea
                name="note"
                placeholder="Warranty, follow-up, or care instructions"
              />
            </label>
            <button type="submit" className="primary full">
              Record bill and complete job <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
