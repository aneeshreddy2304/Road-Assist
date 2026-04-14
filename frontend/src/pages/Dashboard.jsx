import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Circle, MapContainer, Marker, TileLayer, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  MapPinned,
  PackageSearch,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  getAlerts,
  getMyMechanicProfile,
  getMechanicParts,
  getOpenRequests,
  listRequests,
  resolveAlert,
  updateMyProfile,
  updateRequestStatus,
} from "../api/endpoints";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/UI";
import { formatCurrencyUSD, formatMilesFromKm } from "../lib/formatters";

delete L.Icon.Default.prototype._getIconUrl;

const mechanicMarker = new L.DivIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#2563eb;border:4px solid #fff;box-shadow:0 10px 20px rgba(37,99,235,0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const incomingMarker = new L.DivIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#16a34a;border:4px solid #fff;box-shadow:0 10px 20px rgba(22,163,74,0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const activeMarker = new L.DivIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#f97316;border:4px solid #fff;box-shadow:0 10px 20px rgba(249,115,22,0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const DEFAULT_CENTER = [37.5407, -77.4360];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [parts, setParts] = useState([]);
  const [incomingJobs, setIncomingJobs] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [range, setRange] = useState("week");

  const loadDashboard = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const profileRes = await getMyMechanicProfile();
      const currentProfile = profileRes.data;
      setProfile(currentProfile);

      const centerLat = currentProfile.lat ?? DEFAULT_CENTER[0];
      const centerLng = currentProfile.lng ?? DEFAULT_CENTER[1];

      const [alertsRes, jobsRes, openRes, partsRes] = await Promise.allSettled([
        getAlerts(),
        listRequests(),
        getOpenRequests({ lat: centerLat, lng: centerLng, radius_km: 20 }),
        getMechanicParts(currentProfile.mechanic_id),
      ]);
      setAlerts(alertsRes.status === "fulfilled" ? alertsRes.value.data : []);
      setAssignedJobs(jobsRes.status === "fulfilled" ? jobsRes.value.data : []);
      setIncomingJobs(openRes.status === "fulfilled" ? openRes.value.data : []);
      setParts(partsRes.status === "fulfilled" ? partsRes.value.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => loadDashboard(true), 20000);
    return () => window.clearInterval(interval);
  }, []);

  const withinRange = (value) => {
    if (!value) return false;
    if (range === "all") return true;
    const target = new Date(value);
    const now = new Date();

    if (range === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return target >= weekAgo;
    }
    if (range === "month") {
      return target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();
    }
    if (range === "year") {
      return target.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const activeJobs = assignedJobs.filter((job) => ["accepted", "in_progress"].includes(job.status));
  const completedJobs = assignedJobs.filter((job) => job.status === "completed");
  const completedToday = completedJobs.filter((job) => {
    const created = new Date(job.updated_at ?? job.created_at);
    const now = new Date();
    return created.toDateString() === now.toDateString();
  });
  const lowStockParts = parts.filter((part) => Number(part.quantity) < 4);
  const outOfStockParts = parts.filter((part) => Number(part.quantity) === 0);
  const topStockedParts = [...parts]
    .sort((a, b) => Number(b.quantity) - Number(a.quantity))
    .slice(0, 4);
  const essentialParts = [
    "Battery (12V)",
    "Brake Pads (Front)",
    "Brake Fluid (500ml)",
    "Spark Plug",
    "Engine Oil Filter",
    "Radiator Coolant (1L)",
    "Alternator Belt",
    "Wiper Blade (Front)",
  ];
  const missingEssentials = essentialParts.filter(
    (name) => !parts.some((part) => part.part_name?.toLowerCase() === name.toLowerCase())
  );

  const filteredAssignedJobs = assignedJobs.filter((job) => withinRange(job.updated_at ?? job.created_at));
  const filteredCompletedJobs = completedJobs.filter((job) => withinRange(job.updated_at ?? job.created_at));
  const totalEarnings = filteredCompletedJobs.reduce((sum, job) => sum + Number(job.total_cost || 0), 0);
  const totalJobs = filteredAssignedJobs.length + incomingJobs.filter((job) => withinRange(job.created_at)).length;

  const activityItems = useMemo(() => {
    const jobEvents = assignedJobs.slice(0, 6).map((job) => ({
      id: `job-${job.id}`,
      title: `${job.owner_name || "Owner"} · ${job.problem_desc}`,
      meta: `Job ${job.status.replace("_", " ")} · ${new Date(job.updated_at ?? job.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      timestamp: new Date(job.updated_at ?? job.created_at).getTime(),
      tone: job.status === "completed" ? "success" : job.status === "in_progress" ? "warning" : "info",
    }));

    const alertEvents = alerts.slice(0, 4).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.message,
      meta: `${alert.alert_type.replace("_", " ")} · ${new Date(alert.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      timestamp: new Date(alert.created_at).getTime(),
      tone: "danger",
    }));

    const stockEvents = lowStockParts.slice(0, 4).map((part) => ({
      id: `stock-${part.id}`,
      title: `${part.part_name} is running low`,
      meta: `${part.quantity} left in stock · threshold for demo alert is below 4`,
      timestamp: Date.now() - 1,
      tone: "warning",
    }));

    return [...alertEvents, ...stockEvents, ...jobEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 7);
  }, [assignedJobs, alerts, lowStockParts]);

  const queueColumns = [
    { id: "incoming", title: "New Requests", jobs: incomingJobs, empty: "No new requests nearby" },
    { id: "accepted", title: "Accepted", jobs: activeJobs.filter((job) => job.status === "accepted"), empty: "Nothing accepted yet" },
    { id: "progress", title: "In Progress", jobs: activeJobs.filter((job) => job.status === "in_progress"), empty: "No active repair in progress" },
  ];

  const center = [profile?.lat ?? DEFAULT_CENTER[0], profile?.lng ?? DEFAULT_CENTER[1]];

  const toggleAvailability = async () => {
    if (!profile) return;
    setAvailabilityUpdating(true);
    try {
      const res = await updateMyProfile({ is_available: !profile.is_available });
      setProfile((current) => ({ ...current, is_available: res.data.is_available }));
      await loadDashboard(true);
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const handleResolveAlert = async (id) => {
    await resolveAlert(id);
    setAlerts((current) => current.filter((item) => item.id !== id));
  };

  const handleStatusUpdate = async (jobId, status) => {
    try {
      await updateRequestStatus(jobId, { status });
      await loadDashboard(true);
    } catch (error) {
      alert(error.response?.data?.detail || "Could not update job status");
    }
  };

  const handleAcceptIncoming = async (jobId) => {
    try {
      await updateRequestStatus(jobId, { status: "accepted" });
      await loadDashboard(true);
    } catch (error) {
      alert(error.response?.data?.detail || "Could not accept job");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[32px] border border-[#d8e5ff] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_rgba(255,255,255,0.98)_36%),linear-gradient(135deg,_#071225_0%,_#0c1f3d_55%,_#153b74_100%)] p-6 text-white shadow-[0_28px_80px_rgba(6,18,37,0.18)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Mechanic command center</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Dispatch, inventory, and live requests in one place.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
                Manage incoming roadside calls, track active jobs, monitor stock health, and keep your Richmond service zone live for owners nearby.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={toggleAvailability}
                  disabled={availabilityUpdating}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    profile?.is_available
                      ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/30"
                      : "bg-white/10 text-white/80 ring-1 ring-white/10"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${profile?.is_available ? "bg-emerald-300" : "bg-white/50"}`} />
                  {availabilityUpdating
                    ? "Updating..."
                    : profile?.is_available
                      ? "Online for new requests"
                      : "Offline for new requests"}
                </button>
                <button
                  onClick={() => loadDashboard(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                >
                  <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                  Refresh dashboard
                </button>
                <div className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/10">
                  {[
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "year", label: "Year" },
                    { id: "all", label: "All" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setRange(item.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        range === item.id ? "bg-white text-[#081224]" : "text-white/72 hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:w-[28rem]">
              <HeroStat icon={<Briefcase size={16} />} label="Incoming queue" value={incomingJobs.length} />
              <HeroStat icon={<Gauge size={16} />} label="Active jobs" value={activeJobs.length} />
              <HeroStat icon={<CircleDollarSign size={16} />} label={`This ${range === "all" ? "period" : range}`} value={formatCurrencyUSD(totalEarnings)} />
              <HeroStat icon={<CheckCircle2 size={16} />} label="Completed today" value={completedToday.length} />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={<Briefcase size={18} className="text-[#2563eb]" />} label="Total jobs" value={totalJobs} tone="blue" />
          <MetricCard icon={<CheckCircle2 size={18} className="text-[#16a34a]" />} label="Completed" value={filteredCompletedJobs.length} tone="green" />
          <MetricCard icon={<CircleDollarSign size={18} className="text-[#7c3aed]" />} label="Total earnings" value={formatCurrencyUSD(totalEarnings)} tone="violet" />
          <MetricCard icon={<Activity size={18} className="text-[#f97316]" />} label="Low stock alerts" value={lowStockParts.length} tone="amber" />
          <MetricCard icon={<PackageSearch size={18} className="text-[#0f172a]" />} label="Inventory items" value={parts.length} tone="slate" />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.6fr,0.95fr]">
          <Card className="self-start rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live queue</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#081224]">Dispatch board</h2>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {queueColumns.map((column) => (
                <div key={column.id} className="rounded-[26px] border border-[#e8eefc] bg-[#f8fbff] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#081224]">{column.title}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                      {column.jobs.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {column.jobs.length === 0 ? (
                      <EmptyMiniState message={column.empty} />
                    ) : (
                      column.jobs.slice(0, 5).map((job) => (
                        <DispatchJobCard
                          key={job.id}
                          job={job}
                          variant={column.id}
                          onAccept={() => handleAcceptIncoming(job.id)}
                          onUpdate={handleStatusUpdate}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
            </Card>

          <div className="space-y-4">
            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Service zone</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#081224]">Live Richmond map</h2>
                </div>
                <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-emerald-700">
                  {profile?.is_available ? "Online" : "Offline"}
                </span>
              </div>
              <div className="h-72 overflow-hidden rounded-[24px] border border-[#dbe7ff]">
                <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <ZoomControl position="bottomright" />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <Marker position={center} icon={mechanicMarker} />
                  <Circle center={center} radius={20000} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.06, weight: 1.6 }} />
                  {incomingJobs.slice(0, 10).map((job) => (
                    job.lat && job.lng ? <Marker key={`incoming-${job.id}`} position={[job.lat, job.lng]} icon={incomingMarker} /> : null
                  ))}
                  {activeJobs.slice(0, 10).map((job) => (
                    job.lat && job.lng ? <Marker key={`active-${job.id}`} position={[job.lat, job.lng]} icon={activeMarker} /> : null
                  ))}
                </MapContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-medium text-slate-600">
                <MapLegend color="bg-[#2563eb]" label="You" />
                <MapLegend color="bg-[#16a34a]" label="New requests" />
                <MapLegend color="bg-[#f97316]" label="Active route" />
              </div>
            </Card>

            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick actions</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#081224]">Move fast</h2>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                  <QuickAction to="/jobs" label="Open jobs board" sublabel="Review queue and status updates" icon={<Wrench size={16} />} />
                  <QuickAction to="/inventory" label="Update inventory" sublabel="Add parts or adjust stock" icon={<PackageSearch size={16} />} />
                <QuickAction to="/inventory" label="Resolve low stock" sublabel={`${lowStockParts.length} parts below 4 in stock`} icon={<ShieldAlert size={16} />} />
                <button
                  onClick={toggleAvailability}
                  className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4 text-left transition hover:border-[#2563eb]/30 hover:bg-white"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
                    <Gauge size={16} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#081224]">{profile?.is_available ? "Go offline" : "Go online"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Control whether owners can discover you nearby.</p>
                </button>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.15fr,0.95fr,1fr]">
          <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader eyebrow="Inventory health" title="Inventory register" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <InventoryMetric label="Tracked" value={parts.length} tone="blue" />
              <InventoryMetric label="Low stock" value={lowStockParts.length} tone="amber" />
              <InventoryMetric label="Out of stock" value={outOfStockParts.length} tone="red" />
            </div>
            <div className="mt-4 space-y-3">
              {topStockedParts.length === 0 ? (
                <EmptyMiniState message="No inventory data yet" />
              ) : (
                topStockedParts.map((part) => (
                  <div key={part.id} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#081224]">{part.part_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{part.part_number || "No part number"} · {formatCurrencyUSD(part.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#081224]">{part.quantity}</p>
                        <p className="text-xs text-slate-500">in stock</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Missing essentials</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingEssentials.length === 0 ? (
                  <span className="text-sm text-emerald-700">All core essentials are stocked.</span>
                ) : (
                  missingEssentials.slice(0, 8).map((name) => (
                    <span key={name} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-[#dbe7ff]">
                      {name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader eyebrow="Alerts" title="Attention needed" />
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                lowStockParts.length === 0 ? (
                  <EmptyMiniState message="No alerts right now" />
                ) : (
                  lowStockParts.slice(0, 5).map((part) => (
                    <div key={part.id} className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">
                            {part.part_name} is low with {part.quantity} left
                          </p>
                          <p className="mt-1 text-xs text-amber-700/80">
                            Demo low-stock rule: anything below 4 should be restocked
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">{alert.message}</p>
                        <p className="mt-1 text-xs text-amber-700/80">{alert.alert_type.replace("_", " ")}</p>
                      </div>
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader eyebrow="Activity" title="Recent timeline" />
            <div className="mt-4 space-y-4">
              {activityItems.length === 0 ? (
                <EmptyMiniState message="Activity will appear as jobs and alerts come in" />
              ) : (
                activityItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`mt-1 h-3.5 w-3.5 rounded-full ${timelineDot(item.tone)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#081224]">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.meta}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, value }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
      <div className="flex items-center gap-2 text-white/65">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff]",
    green: "bg-[#ecfdf3]",
    violet: "bg-[#f5f3ff]",
    amber: "bg-[#fff7ed]",
    slate: "bg-[#f8fafc]",
  };
  return (
    <Card className={`rounded-[26px] border border-[#dbe7ff] p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </Card>
  );
}

function DispatchJobCard({ job, variant, onAccept, onUpdate }) {
  const next = {
    accepted: { status: "in_progress", label: "Start work" },
    in_progress: { status: "completed", label: "Complete" },
  }[job.status];

  return (
    <div className="rounded-[22px] border border-[#e3ebff] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-slate-400">
              {new Date(job.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#081224]">{job.problem_desc}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {job.owner_name ? <span>{job.owner_name}</span> : null}
            {job.vehicle_label ? <span>{job.vehicle_label}</span> : null}
            {job.lat && job.lng ? <span>{variant === "incoming" ? "Owner location shared" : "Route active"}</span> : null}
            {job.total_cost ? <span>{formatCurrencyUSD(job.total_cost)}</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {variant === "incoming" ? (
          <button
            onClick={onAccept}
            className="w-full rounded-[16px] bg-[#2563eb] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            Accept request
          </button>
        ) : next ? (
          <button
            onClick={() => onUpdate(job.id, next.status)}
            className="w-full rounded-[16px] bg-[#0f172a] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            {next.label}
          </button>
        ) : (
          <div className="rounded-[16px] bg-[#f8fbff] px-3 py-2.5 text-center text-xs font-medium text-slate-500">
            No action needed
          </div>
        )}
      </div>
    </div>
  );
}

function MapLegend({ color, label }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-[#f8fbff] px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function QuickAction({ to, label, sublabel, icon }) {
  return (
    <Link
      to={to}
      className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] p-4 transition hover:border-[#2563eb]/30 hover:bg-white"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-[#081224]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{sublabel}</p>
    </Link>
  );
}

function SectionHeader({ eyebrow, title }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[#081224]">{title}</h2>
    </div>
  );
}

function InventoryMetric({ label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff] text-[#1d4ed8]",
    amber: "bg-[#fff7ed] text-[#c2410c]",
    red: "bg-[#fef2f2] text-[#dc2626]",
  };
  return (
    <div className={`rounded-[20px] px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyMiniState({ message }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#dbe7ff] bg-white px-4 py-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function timelineDot(tone) {
  return {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-[#2563eb]",
  }[tone] || "bg-slate-400";
}
