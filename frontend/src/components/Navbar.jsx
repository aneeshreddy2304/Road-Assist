import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CarFront,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import {
  addVehicle,
  deleteVehicle,
  getMyMechanicProfile,
  getMyVehicles,
  getOwnerHistory,
  updateMyProfile,
  updateMe,
  updateVehicle,
} from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { formatCurrencyUSD } from "../lib/formatters";

const ownerProfileDefaults = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
};

const vehicleDefaults = {
  nickname: "",
  make: "",
  model: "",
  year: 2022,
  license_plate: "",
  vehicle_type: "car",
  fuel_type: "gasoline",
  color: "",
  notes: "",
};

const mechanicProfileDefaults = {
  name: "",
  email: "",
  phone: "",
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
  address: "",
  specialization: "",
  work_hours: "",
  vehicle_types: ["car"],
  is_available: true,
};

export default function Navbar() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const panelRef = useRef(null);

  const [openPanel, setOpenPanel] = useState(null);
  const [profileForm, setProfileForm] = useState(ownerProfileDefaults);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleEditingId, setVehicleEditingId] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(vehicleDefaults);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [mechanicProfileForm, setMechanicProfileForm] = useState(mechanicProfileDefaults);
  const [mechanicProfileLoading, setMechanicProfileLoading] = useState(false);
  const [mechanicProfileSaving, setMechanicProfileSaving] = useState(false);
  const [mechanicEditMode, setMechanicEditMode] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "owner") return;
    setProfileForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      gender: user.gender || "",
      street_address: user.street_address || "",
      city: user.city || "Richmond",
      state: user.state || "VA",
      postal_code: user.postal_code || "",
    });
    setProfileEditMode(false);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "mechanic" || openPanel !== "mechanic-profile") return;
    setMechanicProfileLoading(true);
    getMyMechanicProfile()
      .then((res) => {
        setMechanicProfileForm({
          name: user.name || "",
          email: res.data.email || user.email || "",
          phone: res.data.phone || user.phone || "",
          street_address: user.street_address || "",
          city: user.city || "Richmond",
          state: user.state || "VA",
          postal_code: user.postal_code || "",
          address: res.data.address || "",
          specialization: res.data.specialization || "",
          work_hours: res.data.work_hours || "",
          vehicle_types: res.data.vehicle_types?.length ? res.data.vehicle_types : ["car"],
          is_available: res.data.is_available,
        });
      })
      .finally(() => setMechanicProfileLoading(false));
  }, [openPanel, user]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!panelRef.current?.contains(event.target)) {
        setOpenPanel(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (user?.role !== "owner") return;

    if (openPanel === "vehicles") {
      setVehiclesLoading(true);
      getMyVehicles()
        .then((res) => setVehicles(res.data))
        .finally(() => setVehiclesLoading(false));
    }

    if (openPanel === "history") {
      setHistoryLoading(true);
      getOwnerHistory()
        .then((res) => setHistoryItems(res.data))
        .finally(() => setHistoryLoading(false));
    }
  }, [openPanel, user?.role]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const togglePanel = (panelId) => {
    setOpenPanel((current) => (current === panelId ? null : panelId));
    setProfileEditMode(false);
    setMechanicEditMode(false);
    if (panelId !== "vehicles") {
      setVehicleFormOpen(false);
      setVehicleEditingId(null);
      setVehicleForm(vehicleDefaults);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      await updateMe({
        name: profileForm.name,
        phone: profileForm.phone || null,
        gender: profileForm.gender || null,
        street_address: profileForm.street_address || null,
        city: profileForm.city || null,
        state: profileForm.state || null,
        postal_code: profileForm.postal_code || null,
      });
      await refreshUser();
      setProfileEditMode(false);
    } finally {
      setProfileSaving(false);
    }
  };

  const startVehicleEdit = (vehicle) => {
    setVehicleEditingId(vehicle.id);
    setVehicleForm({
      nickname: vehicle.nickname || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year || 2022,
      license_plate: vehicle.license_plate || "",
      vehicle_type: vehicle.vehicle_type || "car",
      fuel_type: vehicle.fuel_type || "gasoline",
      color: vehicle.color || "",
      notes: vehicle.notes || "",
    });
    setVehicleFormOpen(true);
  };

  const resetVehicleForm = () => {
    setVehicleEditingId(null);
    setVehicleForm(vehicleDefaults);
    setVehicleFormOpen(false);
  };

  const submitVehicle = async (event) => {
    event.preventDefault();
    setVehicleSaving(true);
    try {
      const payload = {
        ...vehicleForm,
        year: Number(vehicleForm.year),
      };

      const res = vehicleEditingId
        ? await updateVehicle(vehicleEditingId, payload)
        : await addVehicle(payload);

      setVehicles((current) => {
        if (vehicleEditingId) {
          return current.map((item) => (item.id === vehicleEditingId ? res.data : item));
        }
        return [res.data, ...current];
      });
      resetVehicleForm();
    } finally {
      setVehicleSaving(false);
    }
  };

  const removeVehicle = async (vehicleId) => {
    if (!window.confirm("Remove this vehicle from your profile?")) return;
    await deleteVehicle(vehicleId);
    setVehicles((current) => current.filter((item) => item.id !== vehicleId));
  };

  const ownerActions = useMemo(
    () => [
      { id: "history", label: "History", icon: <History size={16} /> },
      { id: "vehicles", label: "Vehicles", icon: <CarFront size={16} /> },
      { id: "profile", label: "Profile", icon: <UserRound size={16} /> },
    ],
    []
  );

  const submitMechanicProfile = async (event) => {
    event.preventDefault();
    setMechanicProfileSaving(true);
    try {
      await Promise.all([
        updateMe({
          name: mechanicProfileForm.name,
          phone: mechanicProfileForm.phone || null,
          street_address: mechanicProfileForm.street_address || null,
          city: mechanicProfileForm.city || null,
          state: mechanicProfileForm.state || null,
          postal_code: mechanicProfileForm.postal_code || null,
        }),
        updateMyProfile({
          address: mechanicProfileForm.address || null,
          specialization: mechanicProfileForm.specialization || null,
          work_hours: mechanicProfileForm.work_hours || null,
          vehicle_types: mechanicProfileForm.vehicle_types,
          is_available: mechanicProfileForm.is_available,
        }),
      ]);
      await refreshUser();
      setMechanicEditMode(false);
    } finally {
      setMechanicProfileSaving(false);
    }
  };

  return (
    <nav className="sticky top-0 z-[700] border-b border-[#16305f] bg-[#071225]/95 text-white shadow-[0_12px_30px_rgba(3,10,24,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0e2b57] text-[#58a6ff] shadow-[0_10px_24px_rgba(23,78,166,0.35)]">
            <Wrench size={18} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Roadside Network</p>
            <p className="text-xl font-semibold tracking-tight text-white">RoadAssist</p>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 lg:flex">
              {user.role === "owner" ? (
                <>
                  <HeaderNavLink to="/search" icon={<Search size={16} />} label="Find Help" active={pathname === "/search"} />
                </>
              ) : null}

              {user.role === "mechanic" ? (
                <>
                  <HeaderNavLink to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" active={pathname === "/dashboard"} />
                  <HeaderNavLink to="/inventory" icon={<CarFront size={16} />} label="Inventory" active={pathname === "/inventory"} />
                  <HeaderNavLink to="/jobs" icon={<ClipboardList size={16} />} label="Jobs" active={pathname === "/jobs"} />
                </>
              ) : null}

              {user.role === "admin" ? (
                <HeaderNavLink to="/admin" icon={<LayoutDashboard size={16} />} label="Admin" active={pathname === "/admin"} />
              ) : null}
            </div>

            {user.role === "owner" ? (
              <div ref={panelRef} className="relative flex items-center gap-2">
                {ownerActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => togglePanel(action.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      openPanel === action.id
                        ? "border-[#58a6ff] bg-[#0f2d59] text-white shadow-[0_0_0_1px_rgba(88,166,255,0.25)]"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-[#58a6ff]/40 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}

                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                  title="Sign out"
                >
                  <LogOut size={17} />
                </button>

                {openPanel === "profile" ? (
                  <PanelShell title="Profile" onClose={() => setOpenPanel(null)}>
                    <form onSubmit={submitProfile} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Name" value={profileForm.name} disabled={!profileEditMode} onChange={(value) => setProfileForm((f) => ({ ...f, name: value }))} />
                        <Field label="Email" value={profileForm.email} disabled />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Phone" value={profileForm.phone} disabled={!profileEditMode} onChange={(value) => setProfileForm((f) => ({ ...f, phone: value }))} />
                        <SelectField
                          label="Gender"
                          value={profileForm.gender}
                          disabled={!profileEditMode}
                          onChange={(value) => setProfileForm((f) => ({ ...f, gender: value }))}
                          options={["", "Female", "Male", "Non-binary", "Prefer not to say"]}
                        />
                      </div>
                      <Field
                        label="Street Address"
                        value={profileForm.street_address}
                        disabled={!profileEditMode}
                        onChange={(value) => setProfileForm((f) => ({ ...f, street_address: value }))}
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="City" value={profileForm.city} disabled={!profileEditMode} onChange={(value) => setProfileForm((f) => ({ ...f, city: value }))} />
                        <Field label="State" value={profileForm.state} disabled={!profileEditMode} onChange={(value) => setProfileForm((f) => ({ ...f, state: value }))} />
                        <Field
                          label="ZIP Code"
                          value={profileForm.postal_code}
                          disabled={!profileEditMode}
                          onChange={(value) => setProfileForm((f) => ({ ...f, postal_code: value }))}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        {profileEditMode ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileEditMode(false);
                                setProfileForm({
                                  name: user.name || "",
                                  email: user.email || "",
                                  phone: user.phone || "",
                                  gender: user.gender || "",
                                  street_address: user.street_address || "",
                                  city: user.city || "Richmond",
                                  state: user.state || "VA",
                                  postal_code: user.postal_code || "",
                                });
                              }}
                              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={profileSaving}
                              className="rounded-full bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2563eb] disabled:opacity-60"
                            >
                              {profileSaving ? "Saving..." : "Save changes"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setProfileEditMode(true)}
                            className="rounded-full bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2563eb]"
                          >
                            Edit Profile
                          </button>
                        )}
                      </div>
                    </form>
                  </PanelShell>
                ) : null}

                {openPanel === "vehicles" ? (
                  <PanelShell
                    title="Vehicles"
                    action={
                      <button
                        onClick={() => {
                          setVehicleEditingId(null);
                          setVehicleForm(vehicleDefaults);
                          setVehicleFormOpen((open) => !open);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-[#1d4ed8] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Plus size={14} />
                        Add vehicle
                      </button>
                    }
                    onClose={() => setOpenPanel(null)}
                  >
                    <div className="space-y-3">
                      {vehicleFormOpen ? (
                        <form onSubmit={submitVehicle} className="rounded-3xl border border-[#19396d] bg-[#09172d] p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">
                              {vehicleEditingId ? "Update vehicle" : "Add vehicle"}
                            </p>
                            <button type="button" onClick={resetVehicleForm} className="text-white/50 hover:text-white">
                              <X size={16} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Field dark label="Vehicle Name" value={vehicleForm.nickname} onChange={(value) => setVehicleForm((f) => ({ ...f, nickname: value }))} />
                            <Field dark label="Make" value={vehicleForm.make} onChange={(value) => setVehicleForm((f) => ({ ...f, make: value }))} />
                            <Field dark label="Model" value={vehicleForm.model} onChange={(value) => setVehicleForm((f) => ({ ...f, model: value }))} />
                            <Field dark label="Year" type="number" value={vehicleForm.year} onChange={(value) => setVehicleForm((f) => ({ ...f, year: value }))} />
                            <Field dark label="License Plate" value={vehicleForm.license_plate} onChange={(value) => setVehicleForm((f) => ({ ...f, license_plate: value.toUpperCase() }))} />
                            <SelectField
                              dark
                              label="Type"
                              value={vehicleForm.vehicle_type}
                              onChange={(value) => setVehicleForm((f) => ({ ...f, vehicle_type: value }))}
                              options={["car", "suv", "truck", "bike", "other"]}
                            />
                            <SelectField
                              dark
                              label="Fuel"
                              value={vehicleForm.fuel_type}
                              onChange={(value) => setVehicleForm((f) => ({ ...f, fuel_type: value }))}
                              options={["gasoline", "hybrid", "diesel", "electric", "plug-in hybrid"]}
                            />
                            <Field dark label="Color" value={vehicleForm.color} onChange={(value) => setVehicleForm((f) => ({ ...f, color: value }))} />
                          </div>
                          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                            Notes
                            <textarea
                              value={vehicleForm.notes}
                              onChange={(event) => setVehicleForm((f) => ({ ...f, notes: event.target.value }))}
                              rows={2}
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                            />
                          </label>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="submit"
                              disabled={vehicleSaving}
                              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b82f6] disabled:opacity-60"
                            >
                              {vehicleSaving ? "Saving..." : vehicleEditingId ? "Update vehicle" : "Add vehicle"}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {vehiclesLoading ? (
                        <PanelMessage>Loading vehicles...</PanelMessage>
                      ) : vehicles.length === 0 ? (
                        <PanelMessage>No vehicles added yet.</PanelMessage>
                      ) : (
                        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                          {vehicles.map((vehicle) => (
                            <div key={vehicle.id} className="rounded-3xl border border-[#dbe7ff] bg-[#f8fbff] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-lg font-semibold text-[#081224]">
                                    {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.license_plate}
                                  </p>
                                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {vehicle.vehicle_type} · {vehicle.fuel_type || "Fuel not set"} · {vehicle.color || "Color not set"}
                                  </p>
                                  {vehicle.notes ? <p className="mt-2 text-sm text-slate-500">{vehicle.notes}</p> : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => startVehicleEdit(vehicle)}
                                    className="rounded-full border border-[#c7dafc] p-2 text-[#2563eb] hover:bg-white"
                                    title="Edit vehicle"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => removeVehicle(vehicle.id)}
                                    className="rounded-full border border-red-100 p-2 text-red-500 hover:bg-red-50"
                                    title="Remove vehicle"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PanelShell>
                ) : null}

                {openPanel === "history" ? (
                  <PanelShell title="Service History" onClose={() => setOpenPanel(null)}>
                    {historyLoading ? (
                      <PanelMessage>Loading service history...</PanelMessage>
                    ) : historyItems.length === 0 ? (
                      <PanelMessage>No completed or active service history yet.</PanelMessage>
                    ) : (
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {historyItems.map((item) => (
                          <div key={item.request_id} className="rounded-3xl border border-[#dbe7ff] bg-[#f8fbff] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2563eb]">{item.status.replace("_", " ")}</p>
                                <p className="mt-2 text-lg font-semibold text-[#081224]">{item.problem_desc}</p>
                                <p className="mt-1 text-sm text-slate-600">{item.mechanic_name}</p>
                                <p className="mt-1 text-sm text-slate-500">{item.vehicle_label} · {item.license_plate}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-[#081224]">
                                  {item.total_cost ? formatCurrencyUSD(item.total_cost) : "Pending"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {new Date(item.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PanelShell>
                ) : null}
              </div>
            ) : user.role === "mechanic" ? (
              <div ref={panelRef} className="relative flex items-center gap-2">
                <button
                  onClick={() => togglePanel("mechanic-profile")}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    openPanel === "mechanic-profile"
                      ? "border-[#58a6ff] bg-[#0f2d59] text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:border-[#58a6ff]/40 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <UserRound size={16} />
                  Profile
                </button>
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 sm:block">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                  title="Sign out"
                >
                  <LogOut size={17} />
                </button>

                {openPanel === "mechanic-profile" ? (
                  <PanelShell title="Mechanic Profile" eyebrow="Mechanic tools" onClose={() => setOpenPanel(null)}>
                    {mechanicProfileLoading ? (
                      <PanelMessage>Loading mechanic profile...</PanelMessage>
                    ) : (
                      <form onSubmit={submitMechanicProfile} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Name" value={mechanicProfileForm.name} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, name: value }))} />
                          <Field label="Email" value={mechanicProfileForm.email} disabled />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Phone" value={mechanicProfileForm.phone} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, phone: value }))} />
                          <Field label="Work Hours" value={mechanicProfileForm.work_hours} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, work_hours: value }))} />
                        </div>
                        <Field label="Workshop Address" value={mechanicProfileForm.address} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, address: value }))} />
                        <Field label="Specialization" value={mechanicProfileForm.specialization} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, specialization: value }))} />
                        <Field label="Street Address" value={mechanicProfileForm.street_address} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, street_address: value }))} />
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="City" value={mechanicProfileForm.city} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, city: value }))} />
                          <Field label="State" value={mechanicProfileForm.state} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, state: value }))} />
                          <Field label="ZIP Code" value={mechanicProfileForm.postal_code} disabled={!mechanicEditMode} onChange={(value) => setMechanicProfileForm((f) => ({ ...f, postal_code: value }))} />
                        </div>
                        <SelectField
                          label="Availability"
                          value={mechanicProfileForm.is_available ? "online" : "offline"}
                          disabled={!mechanicEditMode}
                          onChange={(value) => setMechanicProfileForm((f) => ({ ...f, is_available: value === "online" }))}
                          options={["online", "offline"]}
                        />
                        <div className="flex justify-end gap-2">
                          {mechanicEditMode ? (
                            <>
                              <button type="button" onClick={() => setMechanicEditMode(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5">
                                Cancel
                              </button>
                              <button type="submit" disabled={mechanicProfileSaving} className="rounded-full bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2563eb] disabled:opacity-60">
                                {mechanicProfileSaving ? "Saving..." : "Save changes"}
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setMechanicEditMode(true)} className="rounded-full bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2563eb]">
                              Edit Profile
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </PanelShell>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 sm:block">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                  title="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
              Login
            </Link>
            <Link to="/register" className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b82f6]">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function HeaderNavLink({ to, icon, label, active }) {
  return (
    <NavLink
      to={to}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold tracking-[0.01em] transition ${
        active
          ? "border-[#58a6ff] bg-[linear-gradient(135deg,#0f2d59_0%,#123d78_100%)] text-white shadow-[0_10px_30px_rgba(37,99,235,0.22)]"
          : "border-white/10 bg-white/5 text-white/75 hover:border-[#58a6ff]/40 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </NavLink>
  );
}

function PanelShell({ title, action, onClose, children, eyebrow = "Owner tools" }) {
  return (
    <>
      <div className="fixed inset-0 top-16 z-[710] bg-[#020817]/55 backdrop-blur-[2px]" />
      <div className="fixed right-6 top-24 z-[720] w-[34rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[32px] border border-[#16305f] bg-[#081224] p-5 text-white shadow-[0_30px_80px_rgba(2,8,23,0.72)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#58a6ff]">{eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {action}
            <button onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false, dark = false }) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-[0.18em] ${dark ? "text-white/55" : "text-slate-500"}`}>
      {label}
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={onChange ? (event) => onChange(type === "number" ? Number(event.target.value) : event.target.value) : undefined}
        className={`mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none ${
          dark
            ? "border-white/10 bg-white/5 text-white placeholder:text-white/30"
            : "border-[#dbe7ff] bg-[#f8fbff] text-[#081224] placeholder:text-slate-400"
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, dark = false, disabled = false }) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-[0.18em] ${dark ? "text-white/55" : "text-slate-500"}`}>
      {label}
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none ${
          dark
            ? "border-white/10 bg-white/5 text-white"
            : "border-[#dbe7ff] bg-[#f8fbff] text-[#081224]"
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {options.map((option) => (
          <option key={option || "blank"} value={option} className="text-black">
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

function PanelMessage({ children }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/60">
      {children}
    </div>
  );
}
