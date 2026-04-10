import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getMechanicDashboard,
  getAlerts,
  resolveAlert,
  listRequests,
  updateRequestStatus,
  getMyMechanicProfile,
} from "../api/endpoints";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/UI";
import { Briefcase, Star, AlertTriangle, CheckCircle, IndianRupee } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts]       = useState([]);
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [mechanicId, setMechanicId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await getMyMechanicProfile();
        const currentMechanicId = profileRes.data.mechanic_id;
        setMechanicId(currentMechanicId);

        const [dashRes, alertsRes, jobsRes] = await Promise.all([
          getMechanicDashboard(currentMechanicId),
          getAlerts(),
          listRequests(),
        ]);
        setDashboard(dashRes.data);
        setAlerts(alertsRes.data);
        setJobs(jobsRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleResolveAlert = async (id) => {
    await resolveAlert(id);
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  const handleStatusUpdate = async (jobId, status) => {
    try {
      await updateRequestStatus(jobId, { status });
      setJobs((j) => j.map((x) => x.id === jobId ? { ...x, status } : x));
    } catch (e) {
      alert(e.response?.data?.detail || "Error updating status");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">
        Welcome back, {user?.name} 👋
      </h1>

      {/* Stats grid */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Briefcase size={18} className="text-blue-500" />}
            label="Total Jobs" value={dashboard.total_jobs} bg="bg-blue-50" />
          <StatCard icon={<CheckCircle size={18} className="text-green-500" />}
            label="Completed" value={dashboard.completed_jobs} bg="bg-green-50" />
          <StatCard icon={<Star size={18} className="text-yellow-500" />}
            label="Rating" value={`${dashboard.rating} ★`} bg="bg-yellow-50" />
          <StatCard icon={<IndianRupee size={18} className="text-brand-500" />}
            label="This Week" value={`₹${dashboard.earnings_this_week}`} bg="bg-brand-50" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active jobs */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="font-medium text-gray-800 text-sm">Active & Incoming Jobs</h2>
          {jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length === 0 ? (
            <EmptyState icon="📭" title="No active jobs" subtitle="New requests will appear here" />
          ) : (
            jobs
              .filter((j) => j.status !== "completed" && j.status !== "cancelled")
              .map((job) => (
                <JobCard key={job.id} job={job} onUpdateStatus={handleStatusUpdate} />
              ))
          )}
        </div>

        {/* Alerts */}
        <div>
          <h2 className="font-medium text-gray-800 text-sm mb-2">
            Alerts {alerts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{alerts.length}</span>
            )}
          </h2>
          {alerts.length === 0 ? (
            <Card className="p-4 text-center text-sm text-gray-400">No alerts 🎉</Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <Card key={a.id} className="p-3">
                  <div className="flex gap-2">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{a.message}</p>
                      <button
                        onClick={() => handleResolveAlert(a.id)}
                        className="text-xs text-brand-600 hover:underline mt-1"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }) {
  return (
    <Card className={`p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}

function JobCard({ job, onUpdateStatus }) {
  const nextStatus = {
    requested:   "accepted",
    accepted:    "in_progress",
    in_progress: "completed",
  }[job.status];

  const nextLabel = {
    requested:   "Accept Job",
    accepted:    "Start Work",
    in_progress: "Mark Complete",
  }[job.status];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status} />
            <span className="text-xs text-gray-400">
              {new Date(job.created_at).toLocaleDateString("en-IN")}
            </span>
          </div>
          <p className="text-sm text-gray-800 truncate">{job.problem_desc}</p>
        </div>
        {nextStatus && (
          <button
            onClick={() => onUpdateStatus(job.id, nextStatus)}
            className="shrink-0 bg-brand-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-brand-700 whitespace-nowrap"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </Card>
  );
}
