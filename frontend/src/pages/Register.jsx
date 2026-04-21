import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wrench } from "lucide-react";

import { useAuth } from "../context/AuthContext";

const VEHICLE_OPTIONS = ["car", "bike", "truck", "suv", "other"];

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  gender: "",
  street_address: "",
  city: "",
  state: "",
  postal_code: "",
  role: "owner",
  address: "",
  specialization: "",
  work_hours: "",
  vehicle_types: [],
  warehouse_name: "",
  warehouse_description: "",
  fulfillment_hours: "",
  lat: "",
  lng: "",
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMechanic = form.role === "mechanic";
  const isWarehouse = form.role === "warehouse";

  const mechanicFieldsReady = useMemo(
    () =>
      !isMechanic ||
      Boolean(
        form.address.trim() &&
          form.specialization.trim() &&
          form.work_hours.trim() &&
          form.city.trim() &&
          form.state.trim() &&
          String(form.lat).trim() &&
          String(form.lng).trim()
      ),
    [form, isMechanic]
  );

  const warehouseFieldsReady = useMemo(
    () =>
      !isWarehouse ||
      Boolean(
        form.warehouse_name.trim() &&
          form.address.trim() &&
          form.fulfillment_hours.trim() &&
          form.city.trim() &&
          form.state.trim() &&
          String(form.lat).trim() &&
          String(form.lng).trim()
      ),
    [form, isWarehouse]
  );

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const toggleVehicleType = (value) => {
    setForm((current) => ({
      ...current,
      vehicle_types: current.vehicle_types.includes(value)
        ? current.vehicle_types.filter((item) => item !== value)
        : [...current.vehicle_types, value],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!mechanicFieldsReady) {
      setError("Please complete the mechanic workshop details before submitting.");
      return;
    }
    if (!warehouseFieldsReady) {
      setError("Please complete the warehouse profile details before submitting.");
      return;
    }

    setLoading(true);
    try {
      const response = await register({
        ...form,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
      });

      if (response.access_token) {
        if (response.role === "mechanic") navigate("/dashboard");
        else if (response.role === "warehouse") navigate("/warehouse");
        else navigate("/search");
        return;
      }

      navigate("/login", {
        state: {
          notice:
            response.detail ||
            `Your ${response.role} registration has been submitted and is waiting for admin approval.`,
        },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl mb-3">
            <Wrench size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Join RoadAssist today</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
              {[
                { key: "owner", label: "Vehicle Owner" },
                { key: "mechanic", label: "Mechanic" },
                { key: "warehouse", label: "Warehouse" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField("role", key)}
                  className={`py-1.5 rounded-md text-sm font-medium transition-colors ${
                    form.role === key
                      ? "bg-white text-brand-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="space-y-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Personal details</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={inputClass}
                    placeholder="Your name"
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    required
                  />
                </Field>
                <Field label="Phone" required={isMechanic || isWarehouse}>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={inputClass}
                    placeholder="+1 555 000 0000"
                    required={isMechanic || isWarehouse}
                  />
                </Field>
                <Field label="Gender">
                  <input
                    type="text"
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Password" required>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className={inputClass}
                    placeholder="Min 8 characters"
                    required
                  />
                </Field>
                <Field label="Street address">
                  <input
                    type="text"
                    value={form.street_address}
                    onChange={(e) => updateField("street_address", e.target.value)}
                    className={inputClass}
                    placeholder="123 Main St"
                  />
                </Field>
                <Field label="City" required={isMechanic || isWarehouse}>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className={inputClass}
                    placeholder="Richmond"
                    required={isMechanic || isWarehouse}
                  />
                </Field>
                <Field label="State" required={isMechanic || isWarehouse}>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className={inputClass}
                    placeholder="VA"
                    required={isMechanic || isWarehouse}
                  />
                </Field>
                <Field label="Postal code">
                  <input
                    type="text"
                    value={form.postal_code}
                    onChange={(e) => updateField("postal_code", e.target.value)}
                    className={inputClass}
                    placeholder="23220"
                  />
                </Field>
              </div>
            </section>

            {isMechanic ? (
              <section className="space-y-4 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] p-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Workshop details</p>
                  <p className="mt-1 text-sm text-slate-500">These details are sent to the admin for approval before mechanic login is enabled.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Mechanic center address" required>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className={inputClass}
                      placeholder="1901 Monument Ave, Richmond, VA"
                      required
                    />
                  </Field>
                  <Field label="Specialization" required>
                    <input
                      type="text"
                      value={form.specialization}
                      onChange={(e) => updateField("specialization", e.target.value)}
                      className={inputClass}
                      placeholder="Engine, brakes, electrical"
                      required
                    />
                  </Field>
                  <Field label="Work hours" required>
                    <input
                      type="text"
                      value={form.work_hours}
                      onChange={(e) => updateField("work_hours", e.target.value)}
                      className={inputClass}
                      placeholder="09:00 AM - 06:00 PM"
                      required
                    />
                  </Field>
                  <Field label="Supported vehicle types">
                    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3">
                      {VEHICLE_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleVehicleType(option)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                            form.vehicle_types.includes(option)
                              ? "bg-brand-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Workshop latitude" required>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.lat}
                      onChange={(e) => updateField("lat", e.target.value)}
                      className={inputClass}
                      placeholder="37.5407"
                      required
                    />
                  </Field>
                  <Field label="Workshop longitude" required>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.lng}
                      onChange={(e) => updateField("lng", e.target.value)}
                      className={inputClass}
                      placeholder="-77.4360"
                      required
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {isWarehouse ? (
              <section className="space-y-4 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] p-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Warehouse details</p>
                  <p className="mt-1 text-sm text-slate-500">These details are sent to all admins for review before warehouse login is enabled.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Warehouse name" required>
                    <input
                      type="text"
                      value={form.warehouse_name}
                      onChange={(e) => updateField("warehouse_name", e.target.value)}
                      className={inputClass}
                      placeholder="Capital Fleet Warehouse"
                      required
                    />
                  </Field>
                  <Field label="Warehouse address" required>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className={inputClass}
                      placeholder="6400 Midlothian Tpke, Richmond, VA"
                      required
                    />
                  </Field>
                  <Field label="Fulfillment hours" required>
                    <input
                      type="text"
                      value={form.fulfillment_hours}
                      onChange={(e) => updateField("fulfillment_hours", e.target.value)}
                      className={inputClass}
                      placeholder="Mon-Sat 06:00 AM - 10:00 PM"
                      required
                    />
                  </Field>
                  <Field label="Warehouse description">
                    <input
                      type="text"
                      value={form.warehouse_description}
                      onChange={(e) => updateField("warehouse_description", e.target.value)}
                      className={inputClass}
                      placeholder="Emergency stock for batteries, brakes, lighting, and filters"
                    />
                  </Field>
                  <Field label="Warehouse latitude" required>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.lat}
                      onChange={(e) => updateField("lat", e.target.value)}
                      className={inputClass}
                      placeholder="37.5407"
                      required
                    />
                  </Field>
                  <Field label="Warehouse longitude" required>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.lng}
                      onChange={(e) => updateField("lng", e.target.value)}
                      className={inputClass}
                      placeholder="-77.4360"
                      required
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Creating account..."
                : isMechanic
                  ? "Submit mechanic registration"
                  : isWarehouse
                    ? "Submit warehouse registration"
                    : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent";
