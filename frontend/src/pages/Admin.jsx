import { useState, useEffect } from "react";
import { getAnalytics, getAllMechanics, deactivateMechanic } from "../api/endpoints";
import { Card, Spinner } from "../components/UI";
import { TrendingUp, Users, Briefcase, IndianRupee, Star, ShieldOff } from "lucide-react";

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("overview");

  useEffect(() => {
    Promise.all([getAnalytics(), getAllMechanics()])
      .then(([aRes, mRes]) => {
        setAnalytics(aRes.data);
        setMechanics(mRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeactivate = async (id, name) => {
    if (!confirm(`Deactivate ${name}?`)) return;
    await deactivateMechanic(id);
    setMechanics((m) => m.filter((x) => x.id !== id));
  };

  if (loading) return <Spinner />;

  const s = analytics?.summary || {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {["overview", "mechanics"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Briefcase size={18} className="text-blue-500" />}
              label="Total Requests" value={s.total_requests ?? 0} bg="bg-blue-50" />
            <KpiCard icon={<TrendingUp size={18} className="text-green-500" />}
              label="Completed" value={s.completed ?? 0} bg="bg-green-50" />
            <KpiCard icon={<IndianRupee size={18} className="text-brand-500" />}
              label="Total Revenue" value={`₹${Number(s.total_revenue ?? 0).toLocaleString("en-IN")}`} bg="bg-brand-50" />
            <KpiCard icon={<TrendingUp size={18} className="text-purple-500" />}
              label="Avg Job Value" value={`₹${s.avg_job_value ?? 0}`} bg="bg-purple-50" />
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Request Status Breakdown</h3>
              <div className="space-y-2">
                {[
                  { label: "Active",    value: s.active ?? 0,     color: "bg-blue-400"   },
                  { label: "Completed", value: s.completed ?? 0,  color: "bg-green-400"  },
                  { label: "Cancelled", value: s.cancelled ?? 0,  color: "bg-gray-300"   },
                ].map(({ label, value, color }) => {
                  const total = (s.active ?? 0) + (s.completed ?? 0) + (s.cancelled ?? 0);
                  const pct   = total ? Math.round((value / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span>{label}</span>
                        <span>{value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Top parts */}
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Most Used Parts</h3>
              {analytics?.top_parts?.length === 0 ? (
                <p className="text-sm text-gray-400">No part usage data yet</p>
              ) : (
                <div className="space-y-1.5">
                  {(analytics?.top_parts || []).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1">{p.part_name}</span>
                      <span className="text-gray-400 ml-2 shrink-0">{p.times_used}×</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Users by role */}
          {analytics?.users_by_role && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Platform Users</h3>
              <div className="flex gap-6">
                {Object.entries(analytics.users_by_role).map(([role, count]) => (
                  <div key={role} className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500 capitalize">{role}s</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "mechanics" && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Specialization", "Rating", "Reviews", "Status", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mechanics.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{m.specialization || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                      <span>{m.rating}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.total_reviews}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {m.is_available ? "Available" : "Busy"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeactivate(m.id, m.name)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                    >
                      <ShieldOff size={12} /> Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, bg }) {
  return (
    <Card className={`p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}
