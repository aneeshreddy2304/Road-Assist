import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Briefcase,
  CircleDollarSign,
  ShieldAlert,
  ShieldOff,
  Star,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import { getAnalytics, getAllMechanics, deactivateMechanic, listRequests } from "../api/endpoints";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [mechanics, setMechanics] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    async function load() {
      try {
        const [analyticsRes, mechanicsRes, requestsRes] = await Promise.all([
          getAnalytics(),
          getAllMechanics(),
          listRequests(),
        ]);
        setAnalytics(analyticsRes.data);
        setMechanics(mechanicsRes.data);
        setRequests(requestsRes.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}?`)) return;
    await deactivateMechanic(id);
    setMechanics((current) => current.filter((item) => item.id !== id));
  };

  const summary = analytics?.summary || {};
  const mechanicsOnline = mechanics.filter((mechanic) => mechanic.is_available).length;
  const avgRating =
    mechanics.length > 0
      ? (mechanics.reduce((sum, mechanic) => sum + Number(mechanic.rating || 0), 0) / mechanics.length).toFixed(2)
      : "0.00";

  const requestBoard = useMemo(
    () => [
      { title: "Requested", jobs: requests.filter((job) => job.status === "requested") },
      { title: "Accepted", jobs: requests.filter((job) => job.status === "accepted") },
      { title: "In Progress", jobs: requests.filter((job) => job.status === "in_progress") },
      { title: "Completed", jobs: requests.filter((job) => job.status === "completed").slice(0, 6) },
    ],
    [requests]
  );

  const topMechanics = [...mechanics]
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);

  const topParts = analytics?.top_parts || [];
  const roleBreakdown = analytics?.users_by_role || {};

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[32px] border border-[#d8e5ff] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_rgba(255,255,255,0.98)_36%),linear-gradient(135deg,_#071225_0%,_#0c1f3d_55%,_#153b74_100%)] p-6 text-white shadow-[0_28px_80px_rgba(6,18,37,0.18)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Platform control tower</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Monitor requests, mechanics, and network health in real time.</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
                Keep track of live roadside demand, monitor mechanic performance, and identify inventory or service risks across the Richmond network.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:w-[28rem]">
              <HeroStat icon={<Briefcase size={16} />} label="Total requests" value={summary.total_requests ?? 0} />
              <HeroStat icon={<CircleDollarSign size={16} />} label="Revenue" value={formatCurrencyUSD(summary.total_revenue ?? 0)} />
              <HeroStat icon={<Users size={16} />} label="Mechanics online" value={mechanicsOnline} />
              <HeroStat icon={<Star size={16} />} label="Avg rating" value={avgRating} />
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          {["overview", "mechanics"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                tab === item
                  ? "bg-[#2563eb] text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)]"
                  : "bg-white text-slate-600 ring-1 ring-[#dbe7ff] hover:bg-[#f8fbff]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard icon={<Briefcase size={18} className="text-[#2563eb]" />} label="Open jobs" value={summary.active ?? 0} tone="blue" />
              <MetricCard icon={<TrendingUp size={18} className="text-[#16a34a]" />} label="Completed" value={summary.completed ?? 0} tone="green" />
              <MetricCard icon={<ShieldAlert size={18} className="text-[#f97316]" />} label="Cancelled" value={summary.cancelled ?? 0} tone="amber" />
              <MetricCard icon={<CircleDollarSign size={18} className="text-[#7c3aed]" />} label="Avg job value" value={formatCurrencyUSD(summary.avg_job_value ?? 0)} tone="violet" />
              <MetricCard icon={<Users size={18} className="text-[#0f172a]" />} label="Owners" value={roleBreakdown.owner ?? 0} tone="slate" />
              <MetricCard icon={<Wrench size={18} className="text-[#1d4ed8]" />} label="Mechanics" value={roleBreakdown.mechanic ?? 0} tone="blue" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.65fr,0.9fr]">
              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                <SectionHeader eyebrow="Live requests" title="Operations board" />
                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  {requestBoard.map((column) => (
                    <div key={column.title} className="rounded-[24px] border border-[#e8eefc] bg-[#f8fbff] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#081224]">{column.title}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                          {column.jobs.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {column.jobs.length === 0 ? (
                          <EmptyMiniState message={`No ${column.title.toLowerCase()} jobs`} />
                        ) : (
                          column.jobs.slice(0, 5).map((job) => (
                            <div key={job.id} className="rounded-[18px] border border-[#e3ebff] bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <StatusBadge status={job.status} />
                                <span className="text-[11px] text-slate-400">
                                  {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-medium text-[#081224]">{job.problem_desc}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                  <SectionHeader eyebrow="Network health" title="Mechanics overview" />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InventoryMetric label="Online" value={mechanicsOnline} tone="green" />
                    <InventoryMetric label="Offline" value={Math.max(mechanics.length - mechanicsOnline, 0)} tone="slate" />
                    <InventoryMetric label="Top parts" value={topParts.length} tone="blue" />
                    <InventoryMetric label="Admins" value={roleBreakdown.admin ?? 0} tone="violet" />
                  </div>
                </Card>

                <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                  <SectionHeader eyebrow="Top mechanics" title="Best rated today" />
                  <div className="mt-4 space-y-3">
                    {topMechanics.length === 0 ? (
                      <EmptyMiniState message="No mechanics available yet" />
                    ) : (
                      topMechanics.map((mechanic) => (
                        <div key={mechanic.id} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#081224]">{mechanic.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{mechanic.specialization || "General mechanic"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-[#081224]">{mechanic.rating}</p>
                              <p className="text-xs text-slate-500">{mechanic.total_reviews} reviews</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr,1fr,1fr]">
              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                <SectionHeader eyebrow="Popular parts" title="Most used inventory" />
                <div className="mt-4 space-y-3">
                  {topParts.length === 0 ? (
                    <EmptyMiniState message="No part usage data yet" />
                  ) : (
                    topParts.map((part, index) => (
                      <div key={`${part.part_name}-${index}`} className="flex items-center justify-between rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#081224]">{part.part_name}</p>
                          <p className="mt-1 text-xs text-slate-500">Part demand indicator</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                          {part.times_used}x
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                <SectionHeader eyebrow="User mix" title="Role breakdown" />
                <div className="mt-4 space-y-3">
                  {Object.entries(roleBreakdown).map(([role, count]) => (
                    <div key={role} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold capitalize text-[#081224]">{role}</p>
                        <p className="text-lg font-semibold text-[#081224]">{count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
                <SectionHeader eyebrow="Recent activity" title="Latest requests" />
                <div className="mt-4 space-y-3">
                  {requests.length === 0 ? (
                    <EmptyMiniState message="No recent jobs yet" />
                  ) : (
                    requests.slice(0, 6).map((job) => (
                      <div key={job.id} className="rounded-[20px] border border-[#edf2ff] bg-[#f8fbff] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge status={job.status} />
                          <span className="text-[11px] text-slate-400">
                            {new Date(job.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#081224]">{job.problem_desc}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <Card className="rounded-[30px] border border-[#dbe7ff] bg-white/95 p-5 shadow-lg">
            <SectionHeader eyebrow="Mechanic oversight" title="Network roster" />
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[#e5ecff]">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fbff] text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mechanic</th>
                    <th className="px-4 py-3">Specialization</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2ff] bg-white">
                  {mechanics.map((mechanic) => (
                    <tr key={mechanic.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#081224]">{mechanic.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{mechanic.email}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{mechanic.specialization || "General mechanic"}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Star size={13} className="fill-yellow-400 text-yellow-400" />
                          {mechanic.rating}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mechanic.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {mechanic.is_available ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDeactivate(mechanic.id, mechanic.name)}
                          className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                        >
                          <ShieldOff size={13} />
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
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
    green: "bg-[#ecfdf3] text-[#166534]",
    slate: "bg-[#f8fafc] text-[#334155]",
    blue: "bg-[#eff6ff] text-[#1d4ed8]",
    violet: "bg-[#f5f3ff] text-[#6d28d9]",
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
