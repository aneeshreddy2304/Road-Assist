import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronRight, MapPin, ShieldCheck, TimerReset, Wrench } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const notice = location.state?.notice || "";
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role === "mechanic") navigate("/dashboard");
      else if (user.role === "admin") navigate("/admin");
      else if (user.role === "warehouse") navigate("/warehouse");
      else navigate("/search");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f8fc] px-4 py-10">
      <div className="roadassist-grid absolute inset-0 opacity-40" />
      <div className="roadassist-glow roadassist-float absolute -left-24 top-10 h-64 w-64 rounded-full bg-orange-300/40" />
      <div className="roadassist-glow roadassist-float-delayed absolute right-[-5rem] top-1/3 h-72 w-72 rounded-full bg-emerald-300/30" />
      <div className="roadassist-glow roadassist-float absolute bottom-[-4rem] left-1/3 h-80 w-80 rounded-full bg-sky-300/25" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr,0.95fr] lg:gap-20 lg:px-8">
        <div className="hidden lg:block">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">RoadAssist Dispatch</p>
            <h1 className="mt-5 text-6xl font-semibold leading-[1.02] tracking-tight text-slate-950">
              Breakdowns feel less scary when help feels close.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              Find nearby mechanics, confirm spare parts before you call, and track roadside help with the feel of a modern ride app.
            </p>

            <div className="mt-8 grid max-w-lg gap-3">
              {[
                { icon: <MapPin size={16} />, title: "Live nearby discovery", body: "See available mechanics around your location in real time." },
                { icon: <ShieldCheck size={16} />, title: "Know what parts are in stock", body: "Search inventory before sending a job request." },
                { icon: <TimerReset size={16} />, title: "Track every request", body: "Follow the full journey from request to completion." },
              ].map((item) => (
                <div key={item.title} className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-lg backdrop-blur">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      {item.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative lg:pl-10">
          <div className="roadassist-tilt pointer-events-none absolute inset-0 hidden lg:block">
            <div className="roadassist-tilt-card roadassist-float-delayed absolute -right-6 bottom-10 w-64 rounded-[28px] border border-white/70 bg-[#0f172a]/92 p-5 text-white shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Inventory match</p>
              <p className="mt-4 text-2xl font-semibold">Oxygen Sensor</p>
              <p className="mt-2 text-sm text-white/65">3 shops nearby have this part in stock.</p>
              <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Ready to request
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md rounded-[34px] border border-white/80 bg-white/88 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur xl:max-w-[30rem] xl:p-7">
            <div className="text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 shadow-lg">
                <Wrench size={26} className="text-white" />
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">RoadAssist</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to dispatch help, manage jobs, or track parts nearby.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  placeholder="••••••••"
                />
              </div>

              {notice ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
              ) : null}

              {error ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading ? <ChevronRight size={16} className="transition group-hover:translate-x-0.5" /> : null}
              </button>
            </form>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Quick demo access</p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { label: "Owner", email: "owner1@example.com" },
                  { label: "Mechanic", email: "mechanic1@roadassist.in" },
                  { label: "Admin", email: "admin1@roadassist.in" },
                  { label: "Warehouse", email: "warehouse1@roadassist.in" },
                ].map(({ label, email }) => (
                  <button
                    key={label}
                    onClick={() => setForm({ email, password: "Password123!" })}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-semibold text-orange-600 hover:text-orange-700 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
