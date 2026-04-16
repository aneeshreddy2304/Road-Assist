import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Navigation, ShieldCheck, Wrench } from "lucide-react";

import { getMyMechanicProfile, getOpenRequests, listRequests, updateRequestStatus } from "../api/endpoints";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const RICHMOND = { lat: 37.5407, lng: -77.4360 };

export default function Jobs() {
  const [loading, setLoading] = useState(true);
  const [openJobs, setOpenJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [tab, setTab] = useState("dispatch");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const profileRes = await getMyMechanicProfile();
      const center = {
        lat: profileRes.data.lat ?? RICHMOND.lat,
        lng: profileRes.data.lng ?? RICHMOND.lng,
      };
      const [openRes, myRes] = await Promise.all([
        getOpenRequests({ lat: center.lat, lng: center.lng, radius_km: 20 }),
        listRequests(),
      ]);
      setOpenJobs(openRes.data);
      setMyJobs(myRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const accepted = myJobs.filter((job) => job.status === "accepted");
  const inProgress = myJobs.filter((job) => job.status === "in_progress");
  const completed = myJobs.filter((job) => job.status === "completed");
  const totalEarnings = completed.reduce((sum, job) => sum + Number(job.total_cost || 0), 0);

  const handleStatus = async (jobId, status) => {
    try {
      await updateRequestStatus(jobId, { status });
      await fetchAll();
    } catch (error) {
      alert(error.response?.data?.detail || "Could not update this job");
    }
  };

  const columns = useMemo(
    () => [
      { id: "dispatch", title: "New Requests", jobs: openJobs, empty: "No incoming jobs nearby" },
      { id: "accepted", title: "Accepted", jobs: accepted, empty: "No accepted jobs yet" },
      { id: "progress", title: "In Progress", jobs: inProgress, empty: "No repairs in progress" },
      { id: "completed", title: "Completed", jobs: completed, empty: "No completed jobs yet" },
    ],
    [openJobs, accepted, inProgress, completed]
  );

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mechanic jobs</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Dispatch and work history</h1>
            <p className="mt-2 text-sm text-slate-500">Review new requests, move jobs through status, and track completed work and earnings.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:w-[30rem]">
            <MiniMetric label="New Requests" value={openJobs.length} icon={<Wrench size={16} className="text-[#2563eb]" />} />
            <MiniMetric label="Accepted" value={accepted.length} icon={<ShieldCheck size={16} className="text-[#16a34a]" />} />
            <MiniMetric label="In Progress" value={inProgress.length} icon={<Clock3 size={16} className="text-[#f97316]" />} />
            <MiniMetric label="Earnings" value={formatCurrencyUSD(totalEarnings)} icon={<Navigation size={16} className="text-[#7c3aed]" />} />
          </div>
        </div>

        <div className="inline-flex rounded-full bg-[#f8fbff] p-1 ring-1 ring-[#dbe7ff]">
          {[
            { id: "dispatch", label: `New (${openJobs.length})` },
            { id: "accepted", label: `Accepted (${accepted.length})` },
            { id: "progress", label: `In Progress (${inProgress.length})` },
            { id: "completed", label: `Completed (${completed.length})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === item.id ? "bg-[#0f172a] text-white" : "text-slate-600 hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {columns
            .filter((column) => column.id === tab || (tab === "dispatch" && column.id === "dispatch"))
            .map((column) => (
              <Card key={column.id} className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jobs board</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#081224]">{column.title}</h2>
                  </div>
                  <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                    {column.jobs.length}
                  </span>
                </div>

                <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                  {column.jobs.length === 0 ? (
                    <EmptyState icon="🧰" title={column.empty} subtitle="Requests will appear here as your workflow updates." />
                  ) : (
                    column.jobs.map((job) => (
                      <JobSurface
                        key={job.id}
                        job={job}
                        kind={column.id}
                        onAccept={() => handleStatus(job.id, "accepted")}
                        onStart={() => handleStatus(job.id, "in_progress")}
                        onComplete={() => handleStatus(job.id, "completed")}
                      />
                    ))
                  )}
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon }) {
  return (
    <div className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4">
      <div className="flex items-center gap-2">{icon}<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p></div>
      <p className="mt-3 text-2xl font-semibold text-[#081224]">{value}</p>
    </div>
  );
}

function JobSurface({ job, kind, onAccept, onStart, onComplete }) {
  const actions = {
    dispatch: { label: "Accept request", onClick: onAccept, style: "bg-[#2563eb] hover:bg-[#1d4ed8]" },
    accepted: { label: "Start work", onClick: onStart, style: "bg-[#0f172a] hover:bg-black" },
    progress: { label: "Complete job", onClick: onComplete, style: "bg-[#16a34a] hover:bg-[#15803d]" },
  };
  const action = actions[kind];

  return (
    <div className="rounded-[24px] border border-[#e3ebff] bg-[#f8fbff] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-slate-400">{new Date(job.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-[#081224]">{job.problem_desc}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {job.owner_name ? <p>{job.owner_name}</p> : null}
            {job.vehicle_label ? <p>{job.vehicle_label}{job.license_plate ? ` · ${job.license_plate}` : ""}</p> : null}
            {job.owner_address ? (
              <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[#2563eb]" /> <span>{job.owner_address}</span></p>
            ) : null}
            {job.deadline_at ? (
              <p className="flex items-start gap-2 text-amber-700"><Clock3 size={15} className="mt-0.5 shrink-0" /> <span>Due {new Date(job.deadline_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          {job.total_cost ? <p className="text-base font-semibold text-[#081224]">{formatCurrencyUSD(job.total_cost)}</p> : null}
        </div>
      </div>

      {action ? (
        <button
          onClick={action.onClick}
          className={`mt-4 w-full rounded-[18px] px-4 py-3 text-sm font-semibold text-white transition ${action.style}`}
        >
          {action.label}
        </button>
      ) : (
        <div className="mt-4 rounded-[18px] border border-[#dbe7ff] bg-white px-4 py-3 text-center text-sm font-medium text-slate-500">
          Completed on {new Date(job.updated_at ?? job.created_at).toLocaleDateString("en-US")}
        </div>
      )}
    </div>
  );
}
