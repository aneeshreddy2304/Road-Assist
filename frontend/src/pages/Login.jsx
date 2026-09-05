import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Navigation, ShieldCheck, UserRound, Warehouse, Wrench } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const DEMO_ACCOUNTS = [
  { role: "owner", label: "Owner", email: "owner1@example.com", icon: <UserRound size={15} /> },
  { role: "mechanic", label: "Mechanic", email: "mechanic1@roadassist.in", icon: <Wrench size={15} /> },
  { role: "warehouse", label: "Warehouse", email: "warehouse1@roadassist.in", icon: <Warehouse size={15} /> },
  { role: "admin", label: "Admin", email: "admin1@roadassist.in", icon: <ShieldCheck size={15} /> },
];

const ROLE_STORIES = {
  owner: {
    eyebrow: "Driver response",
    title: "Help is already moving toward you.",
    copy: "Share the situation once. Wingman keeps the mechanic, appointment, and repair status in one clear view.",
    icon: <Navigation size={18} />,
    tone: "lime",
    steps: ["Location received", "Nearby response matched", "Repair status visible"],
  },
  mechanic: {
    eyebrow: "Field operations",
    title: "Walk into every job with the context.",
    copy: "Requests arrive with the vehicle, location, issue, and next task already connected to the work queue.",
    icon: <Wrench size={18} />,
    tone: "blue",
    steps: ["Request routed", "Vehicle context loaded", "Job timeline active"],
  },
  warehouse: {
    eyebrow: "Parts operations",
    title: "Stock is part of the response.",
    copy: "Keep availability, orders, and repair-critical parts close to the work that needs them.",
    icon: <Warehouse size={18} />,
    tone: "orange",
    steps: ["Part requirement found", "Availability checked", "Fulfillment in motion"],
  },
  admin: {
    eyebrow: "Network operations",
    title: "Every handoff stays visible.",
    copy: "Approve the network, monitor the work, and keep each role operating from the same source of truth.",
    icon: <ShieldCheck size={18} />,
    tone: "violet",
    steps: ["Provider review ready", "Network health visible", "Operations in sync"],
  },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("owner");
  const [demoOpen, setDemoOpen] = useState(false);
  const notice = location.state?.notice || "";
  const roleStory = ROLE_STORIES[selectedRole];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role === "mechanic") navigate("/dashboard");
      else if (user.role === "admin") navigate("/admin");
      else if (user.role === "warehouse") navigate("/warehouse");
      else navigate("/search");
    } catch (err) {
      setError(err.response?.data?.detail || "We could not sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wingman-login min-h-[100svh] overflow-hidden bg-[#eff3ed] p-3 text-[#173e31] md:p-4">
      <div className="grid min-h-[calc(100svh-1.5rem)] overflow-hidden rounded-[2rem] bg-[#f8f8f3] shadow-[0_30px_100px_rgba(19,55,43,.14)] min-[900px]:grid-cols-[1.08fr_.92fr] md:min-h-[calc(100svh-2rem)] md:rounded-[2.5rem]">
        <section className="relative hidden overflow-hidden bg-[#173e31] p-8 text-[#f6f3eb] min-[900px]:flex min-[900px]:flex-col">
          <div className="wingman-grain" />
          <div className="wingman-hero-glow wingman-hero-glow-one -right-48 top-24" />
          <svg className="wingman-login-route" viewBox="0 0 700 900" preserveAspectRatio="none" aria-hidden="true">
            <path id="wingman-login-road" className="wingman-login-road-base" d="M-80 785C140 690 64 504 237 447c144-48 88-228 296-208 145 14 95-180 238-264" />
            <path className="wingman-login-road-dash" d="M-80 785C140 690 64 504 237 447c144-48 88-228 296-208 145 14 95-180 238-264" />
            <g className="wingman-login-vehicle"><rect x="-10" y="-6" width="20" height="12" rx="3" /><circle cx="-5" cy="7" r="2.5" /><circle cx="5" cy="7" r="2.5" /><animateMotion dur="13s" repeatCount="indefinite" rotate="auto"><mpath href="#wingman-login-road" /></animateMotion></g>
          </svg>
          <Link to="/" className="relative z-10 flex items-center gap-3 self-start">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#cbff78]"><Navigation size={17} fill="currentColor" /></span>
            <span className="text-xl font-black tracking-[-.07em]">wingman</span>
          </Link>
          <div className="relative z-10 my-auto max-w-xl py-8">
            <p className="wingman-kicker text-[#cbff78]">Roadside operations, in sync</p>
            <h1 className="mt-4 text-5xl font-black leading-[.86] tracking-[-.08em] xl:text-6xl">The road has a plan.<br /><span className="text-[#cbff78]">So do you.</span></h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/65">Open your workspace to find help, manage jobs, track parts, and keep every handoff moving.</p>
          </div>
          <div key={selectedRole} className={`wingman-role-reveal wingman-login-panel wingman-login-tone-${roleStory.tone} relative z-10 rounded-[1.5rem] border border-white/10 bg-white/[.07] p-5 backdrop-blur`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/50">{roleStory.eyebrow}</p><span className="flex items-center gap-2 text-xs font-bold text-[var(--login-accent)]"><span className="h-2 w-2 rounded-full bg-[var(--login-accent)] shadow-[0_0_12px_var(--login-accent)]" /> Network online</span></div>
            <div className="mt-5 flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--login-accent)] text-[#173e31]">{roleStory.icon}</span><div><p className="text-lg font-black leading-tight tracking-[-.045em]">{roleStory.title}</p><p className="mt-2 text-xs leading-5 text-white/55">{roleStory.copy}</p></div></div>
            <div className="mt-5 space-y-2.5 border-t border-white/10 pt-5">
              {roleStory.steps.map((step, index) => <div key={step} className="flex items-center gap-3 text-xs font-semibold text-white/75"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--login-accent)]/40 text-[10px] text-[var(--login-accent)]">{index + 1}</span>{step}<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--login-accent)]" /></div>)}
            </div>
          </div>
        </section>

        <section className="flex min-h-full flex-col p-6 sm:p-8 min-[900px]:p-8 xl:p-10">
          <div className="flex items-center justify-between min-[900px]:hidden">
            <Link to="/" className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173e31] text-[#cbff78]"><Navigation size={15} fill="currentColor" /></span><span className="text-lg font-black tracking-[-.07em]">wingman</span></Link>
            <Link className="text-sm font-bold text-[#426e59] hover:text-[#173e31]" to="/">Back home</Link>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-5 min-[900px]:py-0">
            <div>
              <p className="wingman-kicker text-[#6c8175]">Welcome back</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.07em] text-[#173e31] sm:text-4xl">Pick up where<br />the road left off.</h2>
              <p className="mt-3 text-sm leading-6 text-[#63766b]">Sign in to your Wingman workspace.</p>
            </div>

            <div className="mt-5">
              <p className="wingman-kicker text-[#64786d]">I’m entering as</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => <button type="button" key={account.role} onClick={() => setSelectedRole(account.role)} className={`wingman-role-choice flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${selectedRole === account.role ? "border-[#173e31] bg-[#173e31] text-white shadow-[0_8px_20px_rgba(23,62,49,.14)]" : "border-[#d8e0d8] bg-white text-[#65776d] hover:border-[#8da396] hover:text-[#173e31]"}`}><span className={selectedRole === account.role ? "text-[#cbff78]" : ""}>{account.icon}</span>{account.label}<span className={`ml-auto h-1.5 w-1.5 rounded-full transition ${selectedRole === account.role ? "scale-100 bg-[#cbff78]" : "scale-0 bg-[#cbff78]"}`} /></button>)}
              </div>
            </div>
            {notice ? <div className="mt-5 rounded-xl border border-[#cce3b8] bg-[#edf7df] px-4 py-2.5 text-sm font-medium text-[#3c6849]">{notice}</div> : null}
            {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div> : null}
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label className="block"><span className="wingman-kicker text-[#64786d]">Email</span><input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-[#d8e0d8] bg-white px-4 py-3 text-[15px] outline-none transition placeholder:text-[#9baaa1] focus:border-[#285b44] focus:ring-4 focus:ring-[#d9e9b4]/60" /></label>
              <label className="block"><span className="wingman-kicker text-[#64786d]">Password</span><span className="relative mt-2 block"><input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Enter your password" className="w-full rounded-xl border border-[#d8e0d8] bg-white px-4 py-3 pr-12 text-[15px] outline-none transition placeholder:text-[#9baaa1] focus:border-[#285b44] focus:ring-4 focus:ring-[#d9e9b4]/60" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#7a8c81] hover:text-[#173e31]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
              <button disabled={loading} type="submit" className="wingman-enter-button group flex w-full items-center justify-between rounded-xl bg-[#173e31] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#285b44] disabled:cursor-not-allowed disabled:opacity-60"><span>{loading ? "Signing you in…" : "Enter workspace"}</span><ArrowRight size={18} className="transition group-hover:translate-x-1" /></button>
            </form>
            <div className="mt-4 rounded-xl border border-[#dce4dc] bg-white/65 p-3">
              <button type="button" onClick={() => setDemoOpen((value) => !value)} className="flex w-full items-center justify-between text-left text-sm font-bold text-[#244735]"><span>Try a prebuilt demo workspace</span><span className="text-[#426e59]">{demoOpen ? "−" : "+"}</span></button>
              {demoOpen ? <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e1e8e1] pt-3">{DEMO_ACCOUNTS.map((account) => <button key={account.role} type="button" onClick={() => { setSelectedRole(account.role); setForm({ email: account.email, password: "Password123!" }); setDemoOpen(false); }} className="flex items-center gap-2 rounded-lg bg-[#eff3ed] px-3 py-2.5 text-xs font-bold text-[#315644] transition hover:bg-[#d9e9b4]">{account.icon} Demo {account.label}</button>)}</div> : null}
            </div>
            <p className="mt-4 text-center text-sm text-[#63766b]">New to Wingman? <Link to="/register" className="font-bold text-[#173e31] underline decoration-[#b6da81] decoration-2 underline-offset-4">Create an account</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
