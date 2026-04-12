import { useState, useEffect } from "react";
import { getOpenRequests, listRequests, updateRequestStatus } from "../api/endpoints";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/UI";
import { MapPin, Clock, Car } from "lucide-react";
import { formatCurrencyUSD } from "../lib/formatters";

const RICHMOND = { lat: 37.5407, lng: -77.4360 };

export default function Jobs() {
  const [tab, setTab]         = useState("open");
  const [open, setOpen]       = useState([]);
  const [myJobs, setMyJobs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [openRes, myRes] = await Promise.all([
        getOpenRequests({ lat: RICHMOND.lat, lng: RICHMOND.lng, radius_km: 20 }),
        listRequests(),
      ]);
      setOpen(openRes.data);
      setMyJobs(myRes.data.filter((j) => j.status !== "requested"));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAccept = async (jobId) => {
    try {
      await updateRequestStatus(jobId, { status: "accepted" });
      await fetchAll();
    } catch (e) {
      alert(e.response?.data?.detail || "Could not accept job");
    }
  };

  const handleUpdate = async (jobId, status) => {
    try {
      await updateRequestStatus(jobId, { status });
      setMyJobs((j) => j.map((x) => x.id === jobId ? { ...x, status } : x));
    } catch (e) {
      alert(e.response?.data?.detail || "Error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Jobs</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: "open", label: `Open Requests (${open.length})` },
          { id: "mine", label: `My Jobs (${myJobs.length})` },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "open" && (
        open.length === 0
          ? <EmptyState icon="📭" title="No open requests nearby" subtitle="Check back soon" />
          : (
            <div className="space-y-3">
              {open.map((job) => (
                <OpenJobCard key={job.id} job={job} onAccept={() => handleAccept(job.id)} />
              ))}
            </div>
          )
      )}

      {tab === "mine" && (
        myJobs.length === 0
          ? <EmptyState icon="🔧" title="No jobs yet" subtitle="Accept a request to get started" />
          : (
            <div className="space-y-3">
              {myJobs.map((job) => (
                <MyJobCard key={job.id} job={job} onUpdate={handleUpdate} />
              ))}
            </div>
          )
      )}
    </div>
  );
}

function OpenJobCard({ job, onAccept }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status} />
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} />
              {new Date(job.created_at).toLocaleString("en-IN", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800">{job.problem_desc}</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <MapPin size={11} /> Exact pickup location shared on acceptance
          </p>
        </div>
        <button
          onClick={onAccept}
          className="shrink-0 bg-brand-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-brand-700"
        >
          Accept
        </button>
      </div>
    </Card>
  );
}

function MyJobCard({ job, onUpdate }) {
  const actions = {
    accepted:    { label: "Start Work",      next: "in_progress" },
    in_progress: { label: "Mark Complete",   next: "completed"   },
  };
  const action = actions[job.status];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status} />
            <span className="text-xs text-gray-400">
              {new Date(job.created_at).toLocaleDateString("en-IN")}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800 truncate">{job.problem_desc}</p>
          {job.total_cost && (
            <p className="text-xs text-green-700 mt-0.5 font-medium">Earned: {formatCurrencyUSD(job.total_cost)}</p>
          )}
        </div>
        {action && (
          <button
            onClick={() => onUpdate(job.id, action.next)}
            className="shrink-0 bg-brand-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-brand-700 whitespace-nowrap"
          >
            {action.label}
          </button>
        )}
      </div>
    </Card>
  );
}
