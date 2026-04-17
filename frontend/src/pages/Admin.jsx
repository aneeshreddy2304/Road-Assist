import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  DollarSign,
  Gauge,
  ShieldAlert,
  TriangleAlert,
  UserRoundCog,
  Wrench,
} from "lucide-react";

import { deactivateMechanic, getAllMechanics, getAnalytics } from "../api/endpoints";
import { Card, Spinner, StatusBadge } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const RANGE_OPTIONS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
];

export default function Admin() {
  const [rangeKey, setRangeKey] = useState("week");
  const [analytics, setAnalytics] = useState(null);
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [{ data: analyticsData }, { data: mechanicData }] = await Promise.all([
          getAnalytics({ range: rangeKey }),
          getAllMechanics(),
        ]);
        if (alive) {
          setAnalytics(analyticsData);
          setMechanics(mechanicData);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [rangeKey]);

  const summary = analytics?.summary || {};
  const leaderboard = analytics?.leaderboard || [];
  const lowStock = analytics?.low_stock || [];
  const appointments = analytics?.appointments_calendar || [];
  const alerts = analytics?.unresolved_alerts || [];
  const latestRequests = analytics?.latest_requests || [];
  const earningsTrend = analytics?.earnings_trend || [];
  const requestVolume = analytics?.request_volume || [];
  const funnel = analytics?.funnel || {};
  const topParts = analytics?.top_parts || [];
  const roleBreakdown = analytics?.users_by_role || {};
  const appointmentSummary = analytics?.appointments_summary || {};
  const mechanicsOnline = Number(analytics?.mechanics_online || 0);

  const funnelData = useMemo(
    () => [
      { label: "Requested", value: Number(funnel.requested || 0), tone: "bg-[#fef3c7] text-[#92400e]" },
      { label: "Accepted", value: Number(funnel.accepted || 0), tone: "bg-[#dbeafe] text-[#1d4ed8]" },
      { label: "In Progress", value: Number(funnel.in_progress || 0), tone: "bg-[#ede9fe] text-[#6d28d9]" },
      { label: "Completed", value: Number(funnel.completed || 0), tone: "bg-[#dcfce7] text-[#166534]" },
    ],
    [funnel]
  );

  const responseHours = Number(summary.avg_response_hours || 0);
  const completionHours = Number(summary.avg_completion_hours || 0);
  const maxTrend = Math.max(...earningsTrend.map((item) => Number(item.revenue || 0)), 1);
  const maxVolume = Math.max(...requestVolume.map((item) => Number(item.total || 0)), 1);
  const topVolumePoint =
    requestVolume.length === 0
      ? null
      : requestVolume.reduce((best, item) => (Number(item.total || 0) > Number(best.total || 0) ? item : best), requestVolume[0]);
  const demoTopParts = [
    { part_name: "Brake Pads (Front)", times_used: 18 },
    { part_name: "Battery (12V)", times_used: 15 },
    { part_name: "Oxygen Sensor", times_used: 11 },
    { part_name: "Air Filter", times_used: 9 },
    { part_name: "Tyre Tube (Rear)", times_used: 7 },
  ];
  const displayedTopParts = topParts.length > 0 ? topParts : demoTopParts;
  const mechanicsById = new Map(mechanics.map((mechanic) => [mechanic.id, mechanic]));
  const mechanicPerformance = leaderboard.map((entry) => ({
    ...mechanicsById.get(entry.id),
    ...entry,
  }));

  async function handleDeactivate(mechanicId) {
    setDeactivatingId(mechanicId);
    try {
      await deactivateMechanic(mechanicId);
      const { data } = await getAllMechanics();
      setMechanics(data);
    } finally {
      setDeactivatingId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Admin analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Richmond network control tower</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Review live demand, mechanic performance, revenue, appointment flow, and unresolved service risks from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setRangeKey(option.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  rangeKey === option.key
                    ? "bg-[#0f172a] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                    : "bg-white text-slate-600 ring-1 ring-[#dbe7ff] hover:bg-[#f8fbff]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={<Wrench size={18} className="text-[#1d4ed8]" />} label="Total requests" value={summary.total_requests ?? 0} tone="blue" />
          <MetricCard icon={<Gauge size={18} className="text-[#2563eb]" />} label="Active jobs" value={summary.active ?? 0} tone="slate" />
          <MetricCard icon={<DollarSign size={18} className="text-[#7c3aed]" />} label="Revenue" value={formatCurrencyUSD(summary.total_revenue ?? 0)} tone="violet" />
          <MetricCard icon={<Clock3 size={18} className="text-[#0f766e]" />} label="Avg response" value={`${responseHours.toFixed(1)} hr`} tone="green" />
          <MetricCard icon={<Activity size={18} className="text-[#ea580c]" />} label="Avg completion" value={`${completionHours.toFixed(1)} hr`} tone="amber" />
          <MetricCard icon={<ShieldAlert size={18} className="text-[#dc2626]" />} label="Mechanics online" value={mechanicsOnline} tone="rose" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr,1.2fr,0.95fr]">
          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Status progression" />
            <div className="mt-5 space-y-3">
              {funnelData.map((stage, index) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <div className={`min-w-[8.25rem] rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${stage.tone}`}>
                    {stage.label}
                  </div>
                  <div className="h-[2px] flex-1 bg-[#dbe7ff]" />
                  <div className="min-w-[3.5rem] text-right text-2xl font-semibold text-[#081224]">{stage.value}</div>
                  {index < funnelData.length - 1 ? <div className="w-3 text-slate-300">→</div> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title={`Earnings by ${rangeKey === "day" ? "hour" : rangeKey === "year" || rangeKey === "all" ? "month" : "day"}`} />
            <div className="mt-5 grid min-h-[250px] grid-cols-1 items-end gap-3">
              <div className="flex h-[220px] items-end gap-3 overflow-x-auto">
                {earningsTrend.length === 0 ? (
                  <EmptyMiniState message="No revenue data in this range" />
                ) : (
                  earningsTrend.map((item) => (
                    <div key={item.label} className="flex min-w-[72px] flex-col items-center gap-2">
                      <div className="flex h-[180px] items-end">
                        <div
                          className="w-12 rounded-t-[18px] bg-[linear-gradient(180deg,_#60a5fa_0%,_#1d4ed8_100%)] shadow-[0_12px_26px_rgba(37,99,235,0.18)]"
                          style={{ height: `${Math.max((Number(item.revenue || 0) / maxTrend) * 180, 10)}px` }}
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                      <p className="text-xs font-medium text-[#081224]">{formatCurrencyUSD(item.revenue || 0)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Calendar summary" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="Requested" value={appointmentSummary.requested ?? 0} tone="amber" />
              <MiniMetric label="Confirmed" value={appointmentSummary.confirmed ?? 0} tone="blue" />
              <MiniMetric label="Completed" value={appointmentSummary.completed ?? 0} tone="green" />
              <MiniMetric label="Cancelled" value={appointmentSummary.cancelled ?? 0} tone="rose" />
            </div>
            <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {appointments.length === 0 ? (
                <EmptyMiniState message="No appointments scheduled" />
              ) : (
                appointments.map((item) => (
                  <div key={item.id} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]">{item.appointment_ref}</p>
                        <p className="mt-1 text-sm font-semibold text-[#081224]">{item.service_type}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.owner_name} • {item.mechanic_name}
                        </p>
                      </div>
                      <StatusBadge status={item.status === "confirmed" ? "accepted" : item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.scheduled_for)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title={`Volume by ${rangeKey === "day" ? "hour" : rangeKey === "year" || rangeKey === "all" ? "month" : "day"}`} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniMetric label="Peak slot" value={topVolumePoint?.label || "--"} tone="blue" />
              <MiniMetric label="Peak requests" value={topVolumePoint?.total ?? 0} tone="amber" />
              <MiniMetric label="Active range" value={rangeKey.toUpperCase()} tone="green" />
            </div>
            <div className="mt-5 grid max-h-[300px] gap-3 overflow-y-auto pr-1">
              {requestVolume.length === 0 ? (
                <EmptyMiniState message="No request volume in this range" />
              ) : (
                requestVolume.map((item) => (
                  <div key={item.label} className="grid grid-cols-[88px,1fr,44px] items-center gap-3">
                    <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                    <div className="h-3 overflow-hidden rounded-full bg-[#eef4ff]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,_#38bdf8_0%,_#2563eb_100%)]"
                        style={{ width: `${Math.max((Number(item.total || 0) / maxVolume) * 100, 8)}%` }}
                      />
                    </div>
                    <p className="text-right text-sm font-semibold text-[#081224]">{item.total}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Completed jobs and revenue" />
            <div className="mt-4 max-h-[408px] space-y-3 overflow-y-auto pr-1">
              {mechanicPerformance.length === 0 ? (
                <EmptyMiniState message="No mechanic performance data yet" />
              ) : (
                mechanicPerformance.map((mechanic, index) => (
                  <div key={mechanic.id} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f172a] text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#081224]">{mechanic.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {mechanic.completed_jobs} completed • Rating {Number(mechanic.rating || 0).toFixed(1)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{mechanic.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#081224]">{formatCurrencyUSD(mechanic.revenue || 0)}</p>
                        <p className="mt-1 text-xs text-slate-500">{mechanic.is_available ? "Online" : "Offline"}</p>
                        <button
                          onClick={() => handleDeactivate(mechanic.id)}
                          disabled={deactivatingId === mechanic.id}
                          className="mt-2 rounded-full border border-[#fecaca] px-3 py-1 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deactivatingId === mechanic.id ? "Deactivating..." : "Deactivate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr,1fr]">
          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Low-stock heatmap" />
            <div className="mt-4 max-h-[520px] overflow-auto rounded-[22px] border border-[#e5ecff]">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fbff] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Part</th>
                    <th className="px-4 py-3">Mechanic</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2ff] bg-white">
                  {lowStock.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                        No low-stock parts right now
                      </td>
                    </tr>
                  ) : (
                    lowStock.map((item) => (
                      <tr key={`${item.id}-${item.part_name}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#081224]">{item.part_name}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.mechanic_name}</td>
                        <td className="px-4 py-3 font-semibold text-[#081224]">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <RiskPill severity={item.severity} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Flagged mechanics and risks" />
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <EmptyMiniState message="No unresolved alerts" />
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[20px] border border-[#fde7d9] bg-[#fffaf5] px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-full bg-[#fff1e7] p-2 text-[#ea580c]">
                        <TriangleAlert size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#7c2d12]">{alert.mechanic_name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#ea580c]">{alert.part_name}</p>
                        <p className="mt-2 text-sm text-[#9a3412]">{alert.message}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDateTime(alert.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Demand hotspots" />
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {displayedTopParts.length === 0 ? (
                <EmptyMiniState message="No part usage data yet" />
              ) : (
                displayedTopParts.map((part, index) => (
                  <div key={`${part.part_name}-${index}`} className="flex items-center justify-between rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#081224]">{part.part_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {topParts.length === 0 ? "Demo demand projection" : "Repeated service demand"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                      {part.times_used}x
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr,1.35fr]">
          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Platform population" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Object.entries(roleBreakdown).map(([role, count]) => (
                <div key={role} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold capitalize text-[#081224]">{role}</p>
                    <p className="text-2xl font-semibold text-[#081224]">{count}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#081224]">Mechanics online</p>
                  <p className="text-2xl font-semibold text-[#081224]">{mechanicsOnline}</p>
                </div>
              </div>
              <div className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#081224]">Tracked mechanics</p>
                  <p className="text-2xl font-semibold text-[#081224]">{mechanics.length}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader title="Tracked service stream" />
            <div className="mt-4 max-h-[360px] overflow-auto rounded-[22px] border border-[#e5ecff]">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fbff] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Mechanic</th>
                    <th className="px-4 py-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2ff] bg-white">
                  {latestRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        No requests in this range
                      </td>
                    </tr>
                  ) : (
                    latestRequests.map((job) => (
                      <tr key={job.id}>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]">{job.request_ref}</p>
                          <p className="mt-1 font-semibold text-[#081224]">{job.problem_desc}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(job.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{job.owner_name}</td>
                        <td className="px-4 py-3 text-slate-600">{job.mechanic_name}</td>
                        <td className="px-4 py-3 font-semibold text-[#081224]">
                          {formatCurrencyUSD(job.total_cost || job.estimated_cost || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
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
    rose: "bg-[#fff1f2]",
  };
  return (
    <Card className={`rounded-[26px] border border-[#dbe7ff] p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </Card>
  );
}

function MiniMetric({ label, value, tone }) {
  const tones = {
    blue: "bg-[#eff6ff] text-[#1d4ed8]",
    green: "bg-[#ecfdf3] text-[#166534]",
    amber: "bg-[#fff7ed] text-[#c2410c]",
    rose: "bg-[#fff1f2] text-[#be123c]",
  };
  return (
    <div className={`rounded-[20px] px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#081224]">{title}</h2>
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

function RiskPill({ severity }) {
  const map = {
    critical: "bg-[#fee2e2] text-[#b91c1c]",
    warning: "bg-[#fff7ed] text-[#c2410c]",
    out: "bg-[#e0e7ff] text-[#4338ca]",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${map[severity] || "bg-slate-100 text-slate-600"}`}>
      {severity}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
