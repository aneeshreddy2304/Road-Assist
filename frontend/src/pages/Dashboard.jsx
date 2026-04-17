import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
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
  Navigation,
  PackageSearch,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  getAlerts,
  getMechanicDashboard,
  getMyMechanicProfile,
  getMechanicParts,
  getOpenRequests,
  listAppointments,
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
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [parts, setParts] = useState([]);
  const [incomingJobs, setIncomingJobs] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [range, setRange] = useState("week");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [costDialog, setCostDialog] = useState(null);

  const loadDashboard = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const profileRes = await getMyMechanicProfile();
      const currentProfile = profileRes.data;
      setProfile(currentProfile);

      const centerLat = currentProfile.lat ?? DEFAULT_CENTER[0];
      const centerLng = currentProfile.lng ?? DEFAULT_CENTER[1];

      const [summaryRes, alertsRes, jobsRes, openRes, partsRes, appointmentsRes] = await Promise.allSettled([
        getMechanicDashboard(currentProfile.mechanic_id),
        getAlerts(),
        listRequests(),
        getOpenRequests({ lat: centerLat, lng: centerLng, radius_km: 20 }),
        getMechanicParts(currentProfile.mechanic_id),
        listAppointments(),
      ]);
      setSummary(summaryRes.status === "fulfilled" ? summaryRes.value.data : null);
      setAlerts(alertsRes.status === "fulfilled" ? alertsRes.value.data : []);
      setAssignedJobs(jobsRes.status === "fulfilled" ? jobsRes.value.data : []);
      setIncomingJobs(openRes.status === "fulfilled" ? openRes.value.data : []);
      setParts(partsRes.status === "fulfilled" ? partsRes.value.data : []);
      setAppointments(appointmentsRes.status === "fulfilled" ? appointmentsRes.value.data : []);
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
    if (range === "six_months") {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      return target >= sixMonthsAgo;
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
  const totalEarnings =
    range === "all"
      ? Number(summary?.total_earnings || 0)
      : filteredCompletedJobs.reduce((sum, job) => sum + Number(job.total_cost || 0), 0);
  const totalJobs =
    range === "all"
      ? Number(summary?.total_jobs || 0)
      : filteredAssignedJobs.length + incomingJobs.filter((job) => withinRange(job.created_at)).length;
  const completedCount = range === "all" ? Number(summary?.completed_jobs || 0) : filteredCompletedJobs.length;
  const lowDeadlineJobs = activeJobs.filter((job) => {
    if (!job.deadline_at || job.status === "completed" || job.status === "cancelled") return false;
    const hoursLeft = (new Date(job.deadline_at).getTime() - Date.now()) / 36e5;
    return hoursLeft <= 3;
  });
  const selectedMapJob =
    [...incomingJobs, ...activeJobs, ...filteredCompletedJobs].find((job) => job.id === selectedJobId)
    || incomingJobs[0]
    || activeJobs[0]
    || filteredCompletedJobs[0]
    || null;
  const upcomingAppointments = appointments
    .filter((appointment) => ["requested", "confirmed"].includes(appointment.status))
    .slice(0, 4);

  useEffect(() => {
    if (!selectedJobId && selectedMapJob?.id) {
      setSelectedJobId(selectedMapJob.id);
    }
  }, [selectedJobId, selectedMapJob]);

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

    const deadlineEvents = lowDeadlineJobs.slice(0, 4).map((job) => ({
      id: `deadline-${job.id}`,
      title: `${job.owner_name || "Owner"} deadline approaching`,
      meta: `${job.problem_desc} · due ${new Date(job.deadline_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      timestamp: new Date(job.deadline_at).getTime(),
      tone: "danger",
    }));

    const appointmentEvents = upcomingAppointments.slice(0, 4).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: `${appointment.owner_name || "Owner"} scheduled ${appointment.service_type}`,
      meta: `${new Date(appointment.scheduled_for).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} · ${appointment.status}`,
      timestamp: new Date(appointment.scheduled_for).getTime(),
      tone: "info",
    }));

    return [...deadlineEvents, ...appointmentEvents, ...alertEvents, ...stockEvents, ...jobEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 7);
  }, [assignedJobs, alerts, lowStockParts, lowDeadlineJobs, upcomingAppointments]);

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

  const submitStatusUpdate = async (jobId, payload) => {
    try {
      await updateRequestStatus(jobId, payload);
      setCostDialog(null);
      await loadDashboard(true);
    } catch (error) {
      alert(error.response?.data?.detail || "Could not update job status");
    }
  };

  const handleAcceptIncoming = async (jobId) => {
    const job = incomingJobs.find((item) => item.id === jobId);
    if (!job) return;
    setCostDialog({
      mode: "estimate",
      job,
      title: "Accept request",
      amount: job.estimated_cost || 129,
      actionLabel: "Accept with estimate",
    });
  };

  const openOwnerNavigation = () => {
    if (!selectedMapJob?.lat || !selectedMapJob?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${selectedMapJob.lat},${selectedMapJob.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Mechanic operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Welcome back, {profile?.name || "Mechanic"}</h1>
            <p className="mt-2 text-sm text-slate-500">Track requests, monitor owner locations, and manage your Richmond service coverage.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleAvailability}
              disabled={availabilityUpdating}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                profile?.is_available
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${profile?.is_available ? "bg-emerald-500" : "bg-slate-400"}`} />
              {availabilityUpdating ? "Updating..." : profile?.is_available ? "Online" : "Offline"}
            </button>
            <button
              onClick={() => loadDashboard(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:border-[#2563eb]/30"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <div className="inline-flex rounded-full bg-[#f8fbff] p-1 ring-1 ring-[#dbe7ff]">
              {[
                { id: "week", label: "Week" },
                { id: "month", label: "Month" },
                { id: "six_months", label: "6 Months" },
                { id: "year", label: "Year" },
                { id: "all", label: "All" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    range === item.id ? "bg-[#0f172a] text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={<Briefcase size={18} className="text-[#2563eb]" />} label="Total jobs" value={totalJobs} tone="blue" />
          <MetricCard icon={<CheckCircle2 size={18} className="text-[#16a34a]" />} label="Completed" value={completedCount} tone="green" />
          <MetricCard icon={<CircleDollarSign size={18} className="text-[#7c3aed]" />} label="Total earnings" value={formatCurrencyUSD(totalEarnings)} tone="violet" />
          <MetricCard icon={<Activity size={18} className="text-[#f97316]" />} label="Low stock alerts" value={lowStockParts.length} tone="amber" />
          <MetricCard icon={<PackageSearch size={18} className="text-[#0f172a]" />} label="Inventory items" value={parts.length} tone="slate" />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.28fr,0.92fr]">
          <div className="space-y-4">
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
                  <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                    {column.jobs.length === 0 ? (
                      <EmptyMiniState message={column.empty} />
                    ) : (
                      column.jobs.slice(0, 5).map((job) => (
                        <DispatchJobCard
                          key={job.id}
                          job={job}
                          variant={column.id}
                          onAccept={() => handleAcceptIncoming(job.id)}
                          onUpdate={(status) => {
                            if (status === "completed") {
                              setCostDialog({
                                mode: "final",
                                job,
                                title: "Complete job",
                                amount: job.total_cost || job.estimated_cost || 149,
                                actionLabel: "Complete with final cost",
                              });
                              return;
                            }
                            submitStatusUpdate(job.id, { status });
                          }}
                          onSelect={() => setSelectedJobId(job.id)}
                          isSelected={selectedMapJob?.id === job.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[#e8eefc] bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Past work</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#081224]">Completed job register</h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                  {filteredCompletedJobs.length}
                </span>
              </div>
              <div className="mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1">
                {filteredCompletedJobs.length === 0 ? (
                  <EmptyMiniState message="Completed jobs for this filter will show here" />
                ) : (
                  filteredCompletedJobs.slice(0, 6).map((job) => (
                    <div key={`done-${job.id}`} className="flex items-start justify-between gap-4 rounded-[18px] border border-[#e3ebff] bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#081224]">{job.owner_name || "Owner"} · {job.problem_desc}</p>
                        <p className="mt-1 text-xs text-slate-500">{job.vehicle_label || "Vehicle"} · {job.owner_address || "Owner address unavailable"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#081224]">{formatCurrencyUSD(job.total_cost || 0)}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(job.updated_at ?? job.created_at).toLocaleDateString("en-US")}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg xl:min-h-[27rem]">
                <SectionHeader eyebrow="Inventory health" title="Inventory register" />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <InventoryMetric label="Tracked" value={parts.length} tone="blue" />
                  <InventoryMetric label="Low stock" value={lowStockParts.length} tone="amber" />
                  <InventoryMetric label="Out of stock" value={outOfStockParts.length} tone="red" />
                </div>
                <div className="mt-4 max-h-[11rem] space-y-3 overflow-y-auto pr-1">
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Missing essentials</p>
                      <p className="mt-1 text-sm text-slate-500">Fast checklist for commonly needed service items.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                      {missingEssentials.length}
                    </span>
                  </div>
                  <div className="mt-3 flex max-h-[10rem] flex-wrap gap-2 overflow-y-auto pr-1">
                    {missingEssentials.length === 0 ? (
                      <span className="text-sm text-emerald-700">All core essentials are stocked.</span>
                    ) : (
                      missingEssentials.slice(0, 12).map((name) => (
                        <span key={name} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-[#dbe7ff]">
                          {name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg xl:min-h-[27rem]">
                <SectionHeader eyebrow="Alerts" title="Attention needed" />
                <div className="mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1">
                  {alerts.length === 0 ? (
                    lowStockParts.length === 0 && lowDeadlineJobs.length === 0 ? (
                      <EmptyMiniState message="No alerts right now" />
                    ) : (
                      [...lowDeadlineJobs.slice(0, 3), ...lowStockParts.slice(0, 5)].map((item) => (
                        <div key={item.id} className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-900">
                                {"deadline_at" in item
                                  ? `${item.owner_name || "Owner"} deadline is within 3 hours`
                                  : `${item.part_name} is low with ${item.quantity} left`}
                              </p>
                              <p className="mt-1 text-xs text-amber-700/80">
                                {"deadline_at" in item
                                  ? `${item.problem_desc} · due ${new Date(item.deadline_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                                  : "Demo low-stock rule: anything below 4 should be restocked"}
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

                <div className="mt-4 rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-4">
                  <SectionHeader eyebrow="Activity" title="Recent timeline" />
                  <div className="mt-4 max-h-[10rem] space-y-4 overflow-y-auto pr-1">
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
                </div>
              </Card>
            </div>
          </div>

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
              <div className="h-80 overflow-hidden rounded-[24px] border border-[#dbe7ff]">
                <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <ZoomControl position="bottomright" />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <Marker position={center} icon={mechanicMarker} />
                  <Circle center={center} radius={20000} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.06, weight: 1.6 }} />
                  {incomingJobs.slice(0, 10).map((job) => (
                    job.lat && job.lng ? (
                      <Marker key={`incoming-${job.id}`} position={[job.lat, job.lng]} icon={incomingMarker}>
                        <Popup>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{job.owner_name || "Owner request"}</p>
                            <p className="text-xs text-slate-500">{job.problem_desc}</p>
                            <p className="text-xs text-slate-500">{job.owner_address || "Address unavailable"}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null
                  ))}
                  {activeJobs.slice(0, 10).map((job) => (
                    job.lat && job.lng ? (
                      <Marker key={`active-${job.id}`} position={[job.lat, job.lng]} icon={activeMarker}>
                        <Popup>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{job.owner_name || "Active job"}</p>
                            <p className="text-xs text-slate-500">{job.problem_desc}</p>
                            <p className="text-xs text-slate-500">{job.owner_address || "Address unavailable"}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null
                  ))}
                </MapContainer>
              </div>
              <div className="mt-4 rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected owner</p>
                    <h3 className="mt-1 text-lg font-semibold text-[#081224]">
                      {selectedMapJob?.owner_name || "No owner selected"}
                    </h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedMapJob?.problem_desc || "Choose a request from the queue to focus the route."}</p>
                  {selectedMapJob?.deadline_at ? (
                    <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                      Due by {new Date(selectedMapJob.deadline_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  ) : null}
                </div>
                  {selectedMapJob?.lat && selectedMapJob?.lng ? (
                    <button
                      onClick={openOwnerNavigation}
                      className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Navigation size={14} />
                      Navigate
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[#e3ebff] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Owner address</p>
                    <p className="mt-2 text-sm font-medium text-[#081224]">{selectedMapJob?.owner_address || "Waiting for request details"}</p>
                  </div>
                  <div className="rounded-[18px] border border-[#e3ebff] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
                    <p className="mt-2 text-sm font-medium text-[#081224]">
                      {selectedMapJob?.vehicle_label ? `${selectedMapJob.vehicle_label}${selectedMapJob.license_plate ? ` · ${selectedMapJob.license_plate}` : ""}` : "No assigned vehicle yet"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-medium text-slate-600">
                <MapLegend color="bg-[#2563eb]" label="You" />
                <MapLegend color="bg-[#16a34a]" label="New requests" />
                <MapLegend color="bg-[#f97316]" label="Active route" />
              </div>
            </Card>

            <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
              <SectionHeader eyebrow="Workshop board" title="Action hub" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <QuickAction to="/jobs" label="Open jobs board" sublabel="Review queue and status updates" icon={<Wrench size={16} />} />
                <QuickAction to="/inventory" label="Update inventory" sublabel={`Track ${parts.length} parts across your workshop`} icon={<PackageSearch size={16} />} />
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
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Appointments</p>
                      <p className="mt-1 text-sm font-semibold text-[#081224]">Booked service schedule</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                      {upcomingAppointments.length} upcoming
                    </span>
                  </div>
                  <div className="mt-3 max-h-[16rem] space-y-2 overflow-y-auto pr-1">
                    {upcomingAppointments.length === 0 ? (
                      <p className="text-sm text-slate-500">New scheduled services will show here once owners book a future slot.</p>
                    ) : (
                      appointments
                        .filter((appointment) => ["requested", "confirmed"].includes(appointment.status))
                        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
                        .map((appointment) => (
                        <div key={appointment.id} className="rounded-[16px] border border-[#e3ebff] bg-white px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#081224]">{appointment.owner_name || "Owner"}</p>
                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[#2563eb]">
                                {appointment.service_type}
                              </p>
                            </div>
                            <StatusBadge status={appointment.status} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {new Date(appointment.scheduled_for).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          {appointment.notes ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">{appointment.notes}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>

      {costDialog ? (
        <CostActionModal
          title={costDialog.title}
          mode={costDialog.mode}
          job={costDialog.job}
          initialAmount={costDialog.amount}
          actionLabel={costDialog.actionLabel}
          onClose={() => setCostDialog(null)}
          onSubmit={(amount, note) =>
            submitStatusUpdate(costDialog.job.id, {
              status: costDialog.mode === "estimate" ? "accepted" : "completed",
              estimated_cost: costDialog.mode === "estimate" ? amount : undefined,
              final_cost: costDialog.mode === "final" ? amount : undefined,
              note: note || undefined,
            })
          }
        />
      ) : null}
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

function DispatchJobCard({ job, variant, onAccept, onUpdate, onSelect, isSelected }) {
  const next = {
    accepted: { status: "in_progress", label: "Start work" },
    in_progress: { status: "completed", label: "Complete" },
  }[job.status];

  return (
    <div
      onClick={onSelect}
      className={`w-full rounded-[22px] border p-4 text-left shadow-sm transition ${
        isSelected
          ? "border-[#2563eb] bg-[#eff6ff]"
          : "border-[#e3ebff] bg-white hover:border-[#c7dafc]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-slate-400">
              {new Date(job.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#081224]">{job.problem_desc}</p>
          {job.request_ref ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
              {job.request_ref}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {job.owner_name ? <span>{job.owner_name}</span> : null}
            {job.vehicle_label ? <span>{job.vehicle_label}</span> : null}
            {job.owner_address ? <span>{job.owner_address}</span> : null}
            {job.lat && job.lng ? <span>{variant === "incoming" ? "Owner location shared" : "Route active"}</span> : null}
            {job.deadline_at ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
                Due {new Date(job.deadline_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
            {job.status === "completed" && job.total_cost ? (
              <span>{formatCurrencyUSD(job.total_cost)}</span>
            ) : job.estimated_cost ? (
              <span>{formatCurrencyUSD(job.estimated_cost)} est.</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {variant === "incoming" ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
            className="w-full rounded-[16px] bg-[#2563eb] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            Accept request
          </button>
        ) : next ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onUpdate(job.id, next.status);
            }}
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

function CostActionModal({ title, mode, job, initialAmount, actionLabel, onClose, onSubmit }) {
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(Number(amount), note);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[760] flex items-center justify-center bg-[#020817]/60 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-[30px] border border-[#dbe7ff] bg-white p-6 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {mode === "estimate" ? "Estimate for owner" : "Finalize repair"}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-[#081224]">{title}</h3>
            <p className="mt-2 text-sm text-slate-500">
              {job.owner_name || "Owner"} · {job.problem_desc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {mode === "estimate" ? "Estimate cost" : "Final cost"}
            <div className="mt-2 flex items-center rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4">
              <span className="text-lg font-semibold text-slate-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-14 w-full bg-transparent px-2 text-base font-semibold text-[#081224] outline-none"
                required
              />
            </div>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Note for owner
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={mode === "estimate" ? "Optional note about what this estimate covers..." : "Optional completion note or invoice summary..."}
              className="mt-2 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#081224] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#2563eb]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[18px] bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : actionLabel}
            </button>
          </div>
        </form>
      </div>
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
