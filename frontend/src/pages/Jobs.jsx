import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Navigation, RefreshCw, Search, ShieldCheck, Wrench } from "lucide-react";

import {
  getMyMechanicProfile,
  getOpenRequests,
  listAppointments,
  listRequests,
  updateAppointmentStatus,
  updateRequestStatus,
} from "../api/endpoints";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/UI";
import { formatCurrencyUSD } from "../lib/formatters";

const RICHMOND = { lat: 37.5407, lng: -77.4360 };

export default function Jobs() {
  const [loading, setLoading] = useState(true);
  const [openJobs, setOpenJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState("dispatch");
  const [costDialog, setCostDialog] = useState(null);
  const [appointmentDialog, setAppointmentDialog] = useState(null);
  const [lookupQuery, setLookupQuery] = useState("");

  const extractErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || (typeof item === "string" ? item : JSON.stringify(item)))
        .join(", ");
    }
    if (detail && typeof detail === "object") {
      return detail.message || JSON.stringify(detail);
    }
    if (typeof error?.response?.data === "string" && error.response.data.trim()) return error.response.data;
    return error?.message || fallback;
  };

  const fetchAll = async (background = false) => {
    if (!background) setLoading(true);
    try {
      const profileRes = await getMyMechanicProfile();
      const center = {
        lat: profileRes.data.lat ?? RICHMOND.lat,
        lng: profileRes.data.lng ?? RICHMOND.lng,
      };
      const [openRes, myRes, apptRes] = await Promise.all([
        getOpenRequests({ lat: center.lat, lng: center.lng, radius_km: 20 }),
        listRequests(),
        listAppointments(),
      ]);
      setOpenJobs(openRes.data);
      setMyJobs(myRes.data);
      setAppointments(apptRes.data);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchAll(true);
    }, 20000);
    return () => window.clearInterval(interval);
  }, []);

  const accepted = myJobs.filter((job) => job.status === "accepted");
  const inProgress = myJobs.filter((job) => job.status === "in_progress");
  const completed = myJobs.filter((job) => job.status === "completed");
  const totalEarnings = completed.reduce((sum, job) => sum + Number(job.total_cost || 0), 0);
  const pendingAppointments = appointments.filter((item) => ["requested", "confirmed"].includes(item.status));
  const searchResult = useMemo(() => {
    const normalized = lookupQuery.trim().toUpperCase();
    if (!normalized) return null;

    const normalize = (value) => String(value || "").trim().toUpperCase();
    const requestMatches = [...openJobs, ...myJobs].find((job) => {
      const ref = normalize(job.request_ref || `RA-${String(job.id || "").slice(0, 8)}`);
      return normalize(job.id) === normalized || ref === normalized;
    });
    if (requestMatches) {
      const kind =
        requestMatches.status === "requested" && !requestMatches.mechanic_id
          ? "dispatch"
          : requestMatches.status === "accepted"
            ? "accepted"
            : requestMatches.status === "in_progress"
              ? "progress"
              : "completed";
      return { itemType: "request", kind, item: requestMatches, ref: requestMatches.request_ref || `RA-${requestMatches.id.slice(0, 8).toUpperCase()}` };
    }

    const appointmentMatch = appointments.find((appointment) => {
      const ref = normalize(`AP-${String(appointment.id || "").slice(0, 8)}`);
      return normalize(appointment.id) === normalized || ref === normalized;
    });
    if (appointmentMatch) {
      return { itemType: "appointment", kind: "appointments", item: appointmentMatch, ref: `AP-${appointmentMatch.id.slice(0, 8).toUpperCase()}` };
    }
    return { itemType: "missing" };
  }, [appointments, lookupQuery, myJobs, openJobs]);

  const submitStatusUpdate = async (jobId, payload) => {
    try {
      await updateRequestStatus(jobId, payload);
      await fetchAll();
      setCostDialog(null);
    } catch (error) {
      alert(extractErrorMessage(error, "Could not update this job"));
    }
  };

  const handleAppointmentStatus = async (appointmentId, status) => {
    try {
      await updateAppointmentStatus(appointmentId, { status });
      await fetchAll();
    } catch (error) {
      alert(extractErrorMessage(error, "Could not update appointment"));
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mechanic operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#081224]">Jobs workspace</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:w-[32rem]">
            <MiniMetric label="New Requests" value={openJobs.length} icon={<Wrench size={16} className="text-[#2563eb]" />} />
            <MiniMetric label="Appointments" value={pendingAppointments.length} icon={<CalendarDays size={16} className="text-[#16a34a]" />} />
            <MiniMetric label="Earnings" value={formatCurrencyUSD(totalEarnings)} icon={<Navigation size={16} className="text-[#7c3aed]" />} />
          </div>
        </div>

        <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick lookup</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#081224]">Search a request or appointment ID</h2>
              <p className="mt-2 text-sm text-slate-500">Paste a full UUID or short ref like `RA-3DFC7E20` or `AP-7A342CCA` to jump straight to the related job.</p>
            </div>
            <div className="flex w-full max-w-xl gap-3">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={lookupQuery}
                  onChange={(event) => setLookupQuery(event.target.value)}
                  placeholder="Enter request or appointment ID"
                  className="h-12 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] pl-11 pr-4 text-sm text-[#081224] outline-none focus:ring-2 focus:ring-[#2563eb]"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchAll(true)}
                className="inline-flex items-center gap-2 rounded-[20px] border border-[#dbe7ff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f8fbff]"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>

          {searchResult?.itemType === "request" ? (
            <div className="mt-4 rounded-[22px] border border-[#e3ebff] bg-[#f8fbff] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]">{searchResult.ref}</p>
                  <p className="mt-1 text-lg font-semibold text-[#081224]">{searchResult.item.problem_desc}</p>
                  <p className="mt-1 text-sm text-slate-500">{searchResult.item.owner_name} • {searchResult.item.vehicle_label}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={searchResult.item.status} />
                  <p className="mt-2 text-sm font-semibold text-[#081224]">{formatCurrencyUSD(searchResult.item.total_cost || searchResult.item.estimated_cost || 0)}</p>
                  <button
                    type="button"
                    onClick={() => setTab(searchResult.kind)}
                    className="mt-3 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Open section
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {searchResult?.itemType === "appointment" ? (
            <div className="mt-4 rounded-[22px] border border-[#e3ebff] bg-[#f8fbff] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]">{searchResult.ref}</p>
                  <p className="mt-1 text-lg font-semibold text-[#081224]">{searchResult.item.owner_name} · {searchResult.item.service_type}</p>
                  <p className="mt-1 text-sm text-slate-500">{searchResult.item.vehicle_label || "Vehicle not selected"}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={searchResult.item.status === "confirmed" ? "accepted" : searchResult.item.status} />
                  <p className="mt-2 text-xs text-slate-500">{new Date(searchResult.item.scheduled_for).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  <button
                    type="button"
                    onClick={() => setTab("appointments")}
                    className="mt-3 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Open appointments
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {searchResult?.itemType === "missing" ? (
            <p className="mt-4 rounded-[18px] bg-red-50 px-4 py-3 text-sm text-red-600">No request or appointment matched that ID in your workspace.</p>
          ) : null}
        </Card>

        <div className="inline-flex rounded-full bg-[#f8fbff] p-1 ring-1 ring-[#dbe7ff]">
          {[
            { id: "dispatch", label: `Dispatch (${openJobs.length})` },
            { id: "accepted", label: `Accepted (${accepted.length})` },
            { id: "progress", label: `In Progress (${inProgress.length})` },
            { id: "appointments", label: `Appointments (${pendingAppointments.length})` },
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

        {tab === "appointments" ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr,1.15fr]">
                <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Future service</p>
                      <h2 className="mt-1 text-2xl font-semibold text-[#081224]">Appointment queue</h2>
                    </div>
                    <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                      {pendingAppointments.length}
                    </span>
                  </div>
                  <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                    {pendingAppointments.length === 0 ? (
                      <EmptyState icon="🗓️" title="No upcoming appointments" subtitle="Owner-scheduled services will appear here." />
                    ) : (
                      pendingAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="w-full rounded-[22px] border border-[#e3ebff] bg-[#f8fbff] p-4 text-left transition hover:border-[#c7dafc]"
                        >
                          <p className="text-lg font-semibold text-[#081224]">{appointment.owner_name || "Owner"} · {appointment.service_type}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {new Date(appointment.scheduled_for).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{appointment.vehicle_label || "Vehicle not selected"}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{appointment.status}</p>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAppointmentDialog(appointment);
                              }}
                              className="col-span-2 rounded-[16px] border border-[#dbe7ff] bg-white px-3 py-2.5 text-sm font-semibold text-slate-600"
                            >
                              Manage booking
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAppointmentStatus(appointment.id, "confirmed");
                              }}
                              className="rounded-[16px] bg-[#0f172a] px-3 py-2.5 text-sm font-semibold text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAppointmentStatus(appointment.id, "cancelled");
                              }}
                              className="rounded-[16px] border border-[#dbe7ff] bg-white px-3 py-2.5 text-sm font-semibold text-slate-600"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-lg">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Manage bookings</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#081224]">Appointment register</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <MiniMetric label="Requested" value={appointments.filter((item) => item.status === "requested").length} icon={<CalendarDays size={16} className="text-[#2563eb]" />} />
                    <MiniMetric label="Confirmed" value={appointments.filter((item) => item.status === "confirmed").length} icon={<ShieldCheck size={16} className="text-[#16a34a]" />} />
                    <MiniMetric label="Cancelled" value={appointments.filter((item) => item.status === "cancelled").length} icon={<Clock3 size={16} className="text-[#f97316]" />} />
                  </div>
                  <div className="mt-4 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                    {appointments.length === 0 ? (
                      <EmptyState icon="🗓️" title="No appointment history" subtitle="Confirmed, requested, and cancelled bookings will show here." />
                    ) : (
                      appointments.map((appointment) => (
                        <div key={`register-${appointment.id}`} className="rounded-[22px] border border-[#e3ebff] bg-[#f8fbff] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-[#081224]">{appointment.owner_name || "Owner"} · {appointment.service_type}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {new Date(appointment.scheduled_for).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">{appointment.status}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-[#081224]">
                                {appointment.estimated_cost ? formatCurrencyUSD(appointment.estimated_cost) : "Estimate pending"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{appointment.vehicle_label || "No vehicle selected"}</p>
                              <button
                                type="button"
                                onClick={() => setAppointmentDialog(appointment)}
                                className="mt-3 rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                              >
                                Manage
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
          </div>
        ) : (() => {
          const activeColumn = columns.find((column) => column.id === tab || (tab === "dispatch" && column.id === "dispatch"));
          if (!activeColumn) return null;
          return (
            <div className="space-y-4">
              <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jobs board</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#081224]">{activeColumn.title}</h2>
                  </div>
                  <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-[#dbe7ff]">
                    {activeColumn.jobs.length}
                  </span>
                </div>
              </Card>

              {activeColumn.jobs.length === 0 ? (
                <Card className="rounded-[30px] border border-[#dbe7ff] bg-white p-8 shadow-sm">
                  <EmptyState icon="🧰" title={activeColumn.empty} subtitle="Requests will appear here as your workflow updates." />
                </Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {activeColumn.jobs.map((job) => (
          <JobSurface
            key={job.id}
            job={job}
                      kind={activeColumn.id}
                      onAccept={() =>
                        setCostDialog({
                          mode: "estimate",
                          job,
                          title: "Accept request",
                          amount: job.estimated_cost || 129,
                          actionLabel: "Accept with estimate",
                        })
                      }
                      onStart={() => submitStatusUpdate(job.id, { status: "in_progress" })}
                      onComplete={() =>
                        setCostDialog({
                          mode: "final",
                          job,
                          title: "Complete job",
                          amount: job.total_cost || job.estimated_cost || 149,
                          actionLabel: "Complete with final cost",
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
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

      {appointmentDialog ? (
        <MechanicAppointmentModal
          appointment={appointmentDialog}
          onClose={() => setAppointmentDialog(null)}
          onSuccess={async () => {
            setAppointmentDialog(null);
            await fetchAll();
          }}
        />
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value, icon }) {
  return (
    <div className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
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
          {(job.request_ref || job.id) ? (
            <p className="mb-2 inline-flex rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb] ring-1 ring-[#dbe7ff]">
              {job.request_ref || `RA-${job.id.slice(0, 8).toUpperCase()}`}
            </p>
          ) : null}
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
          <p className="text-base font-semibold text-[#081224]">
            {job.status === "completed"
              ? formatCurrencyUSD(job.total_cost || 0)
              : job.estimated_cost
                ? `${formatCurrencyUSD(job.estimated_cost)} est.`
                : "Estimate pending"}
          </p>
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

function MechanicAppointmentModal({ appointment, onClose, onSuccess }) {
  const toLocalInput = (value) => {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [scheduledFor, setScheduledFor] = useState(toLocalInput(appointment.scheduled_for));
  const [serviceType, setServiceType] = useState(appointment.service_type || "General service");
  const [notes, setNotes] = useState(appointment.notes || "");
  const [estimatedCost, setEstimatedCost] = useState(appointment.estimated_cost || "");
  const [status, setStatus] = useState(appointment.status || "requested");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateAppointmentStatus(appointment.id, {
        status,
        scheduled_for: new Date(scheduledFor).toISOString(),
        service_type: serviceType,
        notes,
        estimated_cost: estimatedCost === "" ? null : Number(estimatedCost),
      });
      await onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[760] flex items-center justify-center bg-[#020817]/60 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-[30px] border border-[#dbe7ff] bg-white p-6 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Manage appointment</p>
            <h3 className="mt-1 text-2xl font-semibold text-[#081224]">{appointment.owner_name || "Owner"} · {appointment.service_type}</h3>
            <p className="mt-2 text-sm text-slate-500">{appointment.vehicle_label || "No vehicle selected"}{appointment.license_plate ? ` · ${appointment.license_plate}` : ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 h-12 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]"
            >
              {["requested", "confirmed", "cancelled"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Estimate
            <div className="mt-2 flex items-center rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4">
              <span className="text-base font-semibold text-slate-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={estimatedCost}
                onChange={(event) => setEstimatedCost(event.target.value)}
                className="h-12 w-full bg-transparent px-2 text-sm font-semibold text-[#081224] outline-none"
                placeholder="Optional"
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Scheduled for
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="mt-2 h-12 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Service type
            <input
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              className="mt-2 h-12 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]"
            />
          </label>

          <label className="md:col-span-2 block text-sm font-medium text-slate-700">
            Notes
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 w-full rounded-[20px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#081224] outline-none focus:ring-2 focus:ring-[#2563eb]"
              placeholder="Adjust the booking details or leave a note for the owner..."
            />
          </label>

          {error ? <p className="md:col-span-2 rounded-[18px] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

          <div className="md:col-span-2 grid grid-cols-2 gap-3">
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
              {saving ? "Saving..." : "Save appointment"}
            </button>
          </div>
        </form>
      </div>
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
