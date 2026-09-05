import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Car,
  CarFront,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Package,
  Navigation,
  Pencil,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const RESPONSE_STAGE_COUNT = 3;

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [heroProgressed, setHeroProgressed] = useState(false);
  const appDestination = user
    ? user.role === "mechanic"
      ? "/dashboard"
      : user.role === "warehouse"
        ? "/warehouse"
        : user.role === "admin"
          ? "/admin"
          : "/search"
    : "/login";

  useScrollReveal();

  useEffect(() => {
    const onScroll = () => {
      const node = heroRef.current;
      if (!node) return;
      const travel = Math.max(1, node.offsetHeight - window.innerHeight);
      setHeroProgressed((-node.getBoundingClientRect().top / travel) > .78);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <CinematicDeck appDestination={appDestination} />;

  return (
    <main className="wingman-site bg-[#f1f4ef] text-[#10211b]">
      <section ref={heroRef} className={`wingman-hero-sequence relative h-[170svh] bg-[#173e31] ${heroProgressed ? "wingman-hero-progressed" : ""}`}>
      <div className="wingman-scene wingman-hero sticky top-0 min-h-[100svh] overflow-hidden bg-[#173e31] text-[#f5f1e8]">
        <div className="wingman-grain" />
        <div className="wingman-hero-glow wingman-hero-glow-one" />
        <div className="wingman-hero-glow wingman-hero-glow-two" />
        <div className="wingman-hero-horizon" aria-hidden="true" />
        <div className="wingman-hero-route" aria-hidden="true">
          <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
            <path id="wingman-hero-road" d="M-90 735C180 610 244 260 500 435c230 157 286-115 478 32 162 125 275 30 570-210" />
            <path className="wingman-route-dash" d="M-90 735C180 610 244 260 500 435c230 157 286-115 478 32 162 125 275 30 570-210" />
            <g className="wingman-hero-vehicle">
              <rect x="-11" y="-7" width="22" height="14" rx="4" />
              <circle cx="-6" cy="8" r="3" /><circle cx="6" cy="8" r="3" />
              <animateMotion dur="18s" repeatCount="indefinite" rotate="auto"><mpath href="#wingman-hero-road" /></animateMotion>
            </g>
          </svg>
        </div>

        <nav className="relative z-20 mx-auto flex max-w-[1540px] items-center justify-between px-5 py-6 md:px-10 md:py-8">
          <Link to="/" className="group flex items-center gap-3" aria-label="Wingman home">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 transition group-hover:rotate-[-12deg] group-hover:bg-[#cbff78] group-hover:text-[#163d30]">
              <Navigation size={17} fill="currentColor" />
            </span>
            <span className="text-xl font-black tracking-[-0.07em]">wingman</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold text-white/70 md:flex">
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#network" className="transition hover:text-white">The network</a>
            <Link to="/login" className="transition hover:text-white">Sign in</Link>
          </div>
          <Link to={appDestination} className="inline-flex items-center gap-2 rounded-full bg-[#cbff78] px-4 py-2.5 text-sm font-bold text-[#173e31] transition hover:scale-[1.03] hover:bg-white md:px-5">
            {user ? "Open workspace" : "Explore the demo"} <ArrowUpRight size={16} />
          </Link>
        </nav>

        <div className="wingman-hero-content relative z-10 mx-auto flex min-h-[calc(100svh-92px)] max-w-[1540px] flex-col justify-between px-5 pb-6 pt-7 md:px-10 md:pb-8 md:pt-10">
          <div className="max-w-[1300px]">
            <div className="wingman-enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#cbff78] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#cbff78] shadow-[0_0_16px_#cbff78]" />
              Roadside response, rethought
            </div>
            <h1 className="wingman-enter wingman-enter-two mt-5 max-w-[1300px] text-[clamp(3.7rem,7vw,8rem)] font-black leading-[0.83] tracking-[-0.085em] text-[#f6f3eb]">
              When the road stops,<br />
              <span className="text-[#cbff78]">Wingman starts.</span>
            </h1>
            <p className="wingman-enter wingman-enter-three mt-5 max-w-xl text-sm leading-6 text-white/70 md:text-base md:leading-7">
              A connected roadside-assistance workspace for drivers, mechanics, and parts suppliers, built to turn a breakdown into a clear next move.
            </p>
            <div className="wingman-enter wingman-enter-four mt-6 flex flex-wrap gap-3">
              <Link to={appDestination} className="inline-flex items-center gap-3 rounded-full bg-[#f6f3eb] px-6 py-3.5 text-sm font-bold text-[#163d30] transition hover:-translate-y-0.5 hover:bg-[#cbff78]">
                {user ? "Go to your workspace" : "See the product in motion"} <ArrowDownRight size={17} />
              </Link>
              <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white hover:bg-white/10">
                See how it works
              </button>
            </div>
          </div>

          <div className="wingman-hero-foot wingman-enter wingman-enter-five mt-8 flex flex-wrap items-end justify-between gap-5 border-t border-white/15 pt-4 md:mt-10 md:pt-5">
            <p className="max-w-xs text-sm leading-5 text-white/60">One clear signal, from the roadside to the people who can move it forward.</p>
            <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-[.16em] text-white/65"><span><b className="mr-2 text-[#cbff78]">01</b> Locate</span><span><b className="mr-2 text-[#cbff78]">02</b> Match</span><span><b className="mr-2 text-[#cbff78]">03</b> Move</span></div>
          </div>
        </div>
      </div>
      </section>

      <div className="wingman-marquee overflow-hidden bg-[#cbff78] py-4 text-[#173e31]" aria-hidden="true">
        <div className="wingman-marquee-track whitespace-nowrap text-xl font-black uppercase tracking-[-.04em] md:text-2xl">Locate the problem <span>✦</span> Match the right hands <span>✦</span> Keep the repair moving <span>✦</span> Locate the problem <span>✦</span> Match the right hands <span>✦</span> Keep the repair moving <span>✦</span></div>
      </div>

      <CinematicForward />

      <ResponseJourney />

      <SharedFieldCarousel />

      <section id="network" className="wingman-scene relative flex min-h-[100svh] items-center overflow-hidden bg-[#d9e9b4] px-5 py-16 md:px-10 md:py-20">
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(22,61,48,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(22,61,48,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-[1540px]">
          <div className="wingman-reveal flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="wingman-kicker text-[#42643a]">The demo network</p>
              <h2 className="mt-5 text-5xl font-black leading-[0.88] tracking-[-0.07em] text-[#173e31] md:text-7xl">Every response has a route.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#426043]">Wingman currently demonstrates its verified provider network around Richmond, Virginia. We show that boundary clearly, because trust starts with honesty.</p>
          </div>

          <div className="wingman-map wingman-reveal mt-12 overflow-hidden rounded-[2rem] border border-[#315f49]/20 bg-[#173e31] p-5 shadow-[0_35px_90px_rgba(23,61,49,0.27)] md:p-8">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#cbff78_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="relative grid min-h-[440px] gap-8 lg:grid-cols-[1fr_330px]">
              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#123328]">
                <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(140deg,transparent_45%,rgba(203,255,120,.22)_46%,transparent_47%),linear-gradient(35deg,transparent_49%,rgba(255,255,255,.14)_50%,transparent_51%)] [background-size:260px_220px,320px_280px]" />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 500" aria-hidden="true">
                  <path id="wingman-map-road" className="wingman-map-route" d="M115 365 C260 405, 255 140, 430 225 S595 390, 760 125" />
                  <circle className="wingman-map-pulse" cx="115" cy="365" r="10" />
                  <circle className="wingman-map-point" cx="760" cy="125" r="9" />
                  <g className="wingman-map-vehicle"><rect x="-9" y="-5" width="18" height="11" rx="3" /><circle cx="-5" cy="6" r="2.4" /><circle cx="5" cy="6" r="2.4" /><animateMotion dur="8s" repeatCount="indefinite" rotate="auto"><mpath href="#wingman-map-road" /></animateMotion></g>
                </svg>
                <div className="absolute bottom-5 left-5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur">Richmond demo coverage</div>
                <div className="absolute right-[13%] top-[20%] flex h-12 w-12 items-center justify-center rounded-full bg-[#cbff78] text-[#173e31] shadow-[0_0_0_10px_rgba(203,255,120,.12)]"><Wrench size={19} /></div>
              </div>
              <aside className="relative flex flex-col justify-between rounded-[1.5rem] bg-[#f6f3eb] p-6 text-[#173e31]">
                <div>
                  <div className="flex items-center justify-between"><p className="wingman-kicker text-[#5c7567]">Response match</p><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9e9b4]"><ShieldCheck size={15} /></span></div>
                  <h3 className="mt-7 text-3xl font-black leading-none tracking-[-0.06em]">Reed Auto<br />Works</h3>
                  <p className="mt-3 text-sm text-[#5a6d62]">Engine & electrical · 1.2 mi away</p>
                  <div className="mt-7 space-y-3 border-t border-[#d5ded3] pt-5 text-sm">
                    <div className="flex items-center justify-between"><span className="text-[#62766a]">Availability</span><span className="flex items-center gap-1.5 font-bold text-[#256849]"><CircleDot size={11} fill="currentColor" /> Available now</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#62766a]">Estimated arrival</span><span className="font-bold">8 minutes</span></div>
                  </div>
                </div>
                <button onClick={() => navigate(appDestination)} className="mt-8 flex w-full items-center justify-between rounded-xl bg-[#173e31] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#2e634e]">Explore live workspace <ChevronRight size={17} /></button>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="wingman-scene flex min-h-[100svh] items-center bg-[#173e31] px-5 py-16 text-[#f6f3eb] md:px-10 md:py-20">
        <div className="wingman-reveal mx-auto flex max-w-[1540px] flex-col justify-between gap-12 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="wingman-kicker text-[#cbff78]">Built for the next move</p>
            <h2 className="mt-5 text-5xl font-black leading-[0.86] tracking-[-0.08em] md:text-8xl">Less waiting.<br /><span className="text-[#cbff78]">More way forward.</span></h2>
          </div>
          <Link to={appDestination} className="group inline-flex items-center gap-4 border-b border-[#cbff78] pb-3 text-lg font-bold text-[#cbff78] transition hover:gap-7">Explore Wingman <ArrowUpRight size={21} /></Link>
        </div>
      </section>
    </main>
  );
}

function LandingV2({ appDestination }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);
  const lastTapRef = useRef(0);
  const scenes = [
    { id: "hero", kicker: "Roadside response, rethought", title: <>When the road stops,<br /><em>Wingman starts.</em></>, body: "A connected roadside-assistance workspace for drivers, mechanics, and parts suppliers, built to turn a breakdown into a clear next move." },
    { id: "problem", title: "Help should feel close.", body: "" },
    { id: "availability", title: "Know before you go.", body: "" },
    { id: "timeline", title: "Stay close to the repair.", body: "" },
    { id: "statement", title: <>One signal.<br /><em>Every handoff.</em></>, body: "Each role sees the same response differently; nobody loses the thread." },
    { id: "mechanic", title: "Work arrives with context.", body: "" },
    { id: "health", title: "Know your car between services.", body: "" },
    { id: "dealership", title: <>From roadside<br /><em>to routine care.</em></>, body: "Find immediate help, schedule directly with nearby dealerships such as BMW, and stay ahead of the next service." },
    { id: "dispatch", title: "Prepare the right kind of work.", body: "Warehouse ordering is mechanic-side only." },
    { id: "gallery", title: "See it live.", body: "" },
    { id: "footer", title: "", body: "" },
  ];
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const tap = (event) => {
    if (event.target.closest("a, button")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 330) { clearTimeout(timerRef.current); lastTapRef.current = 0; setActive((v) => Math.max(0, v - 1)); return; }
    lastTapRef.current = now;
    timerRef.current = setTimeout(() => { setActive((v) => Math.min(scenes.length - 1, v + 1)); lastTapRef.current = 0; }, 250);
  };
  const scene = scenes[active];
  return <main className="wingman-v2" onClick={tap} onWheel={(event) => event.preventDefault()}><V2Nav appDestination={appDestination} dark={["problem", "statement", "footer"].includes(scene.id)} /><section key={scene.id} className={`wingman-v2-scene wingman-v2-${scene.id} is-active`}><V2Content scene={scene} appDestination={appDestination} /></section></main>;
}

function V2Nav({ appDestination, dark }) {
  return <nav className={`wingman-v2-nav ${dark ? "is-dark" : ""}`}><Link to="/" className="wingman-v2-brand"><span><Navigation size={16} fill="currentColor" /></span>wingman</Link><div className="wingman-v2-navlinks"><span>How it works</span><span>The network</span><Link to="/login">Sign in</Link></div><Link to={appDestination} className="wingman-v2-cta">Explore the demo <ArrowUpRight size={15} /></Link></nav>;
}

function V2Content({ scene, appDestination }) {
  if (scene.id === "footer") return <footer className="wingman-v2-footer"><p>This prototype currently demonstrates a seeded provider network around Richmond, Virginia. Coverage, availability, and service details shown in the demo are illustrative.</p><div /><div className="wingman-v2-footer-bottom"><strong>wingman</strong><span>Product&nbsp;&nbsp;&nbsp; Company&nbsp;&nbsp;&nbsp; Legal&nbsp;&nbsp;&nbsp; Contact</span></div></footer>;
  if (scene.id === "availability") return <div className="wingman-v2-centered"><h2>{scene.title}</h2><p>See service capability and parts availability before you commit.</p><div className="wingman-v2-compare"><MechanicCard name="Avery Auto Care" unavailable /><MechanicCard name="Reed Auto Works" /></div></div>;
  if (scene.id === "timeline") return <div className="wingman-v2-timeline-wrap"><h2>{scene.title}</h2><div className="wingman-v2-timeline">{["Requested", "Accepted", "In progress", "Completed"].map((item, index) => <div key={item} className={index < 3 ? "is-complete" : ""}><i /><span>{item}</span></div>)}</div></div>;
  if (scene.id === "statement") return <div className="wingman-v2-statement"><h2>{scene.title}</h2><p>{scene.body}</p></div>;
  if (scene.id === "mechanic") return <div className="wingman-v2-split"><div><h2>{scene.title}</h2></div><JobQueue /></div>;
  if (scene.id === "health") return <div className="wingman-v2-centered"><h2>{scene.title}</h2><div className="wingman-v2-healthcards"><div className="wingman-v2-health"><b>8,200</b><span>mi since last service</span></div><div className="wingman-v2-note"><Pencil size={17} /><p>Noticed a rattle near the left wheel</p></div></div></div>;
  if (scene.id === "dealership") return <div className="wingman-v2-dealer"><div><h2>{scene.title}</h2><p>{scene.body}</p></div><CalendarMock /></div>;
  if (scene.id === "dispatch") return <div className="wingman-v2-split"><div><h2>{scene.title}</h2><p>{scene.body}</p></div><DispatchBoard /></div>;
  if (scene.id === "gallery") return <div className="wingman-v2-gallery"><h2>{scene.title}</h2><div>{["Dispatch map", "Mechanic queue", "Repair timeline", "Vehicle notes", "Dealership booking"].map((item, i) => <article key={item} className={`wingman-v2-thumb thumb-${i}`}><span>{item}</span></article>)}</div></div>;
  return <div className={`wingman-v2-copy ${scene.id === "hero" ? "is-hero" : ""}`}><p className="wingman-v2-kicker">{scene.kicker}</p><h1>{scene.title}</h1>{scene.body && <p className="wingman-v2-body">{scene.body}</p>}{scene.id === "hero" && <div className="wingman-v2-actions"><Link to={appDestination}>See the product in motion</Link><span>See how it works</span></div>}{scene.id === "problem" && <div className="wingman-v2-thread"><i /><i /><i /><i /><i /></div>}<V2Route /></div>;
}

function V2Route() { return <svg className="wingman-v2-route" viewBox="0 0 900 600" aria-hidden="true"><path d="M-40 535C160 500 176 344 345 407s174-166 369-189" /><circle cx="345" cy="407" r="6" /><circle cx="714" cy="218" r="6" /></svg>; }
function MechanicCard({ name, unavailable }) { return <article className="wingman-v2-mechanic-card"><b>{name}</b><small>{unavailable ? "Mobile service" : "Shop · Electrical"}</small><hr /><p className={unavailable ? "unavailable" : "available"}>Battery: {unavailable ? "out of stock" : "4 in stock"}</p></article>; }
function JobQueue() { return <div className="wingman-v2-queue">{["Battery fault · 1.2 mi", "Flat tire · 2.8 mi", "Oil service · scheduled"].map((item, i) => <div className={i === 0 ? "focus" : ""} key={item}><b>{item}</b><span>{i === 0 ? "Needs attention" : "In queue"}</span></div>)}</div>; }
function CalendarMock() { return <div className="wingman-v2-calendar"><b>Schedule service</b><div>{Array.from({ length: 14 }, (_, i) => <span className={i === 9 ? "selected" : ""} key={i}>{i + 1}</span>)}</div></div>; }
function DispatchBoard() { return <div className="wingman-v2-dispatch"><header>Live dispatch board <small>streaming</small></header>{["M. Carter · Battery", "J. Walker · Brake check", "A. Reed · Parts pickup", "S. Moore · Engine light"].map((row) => <div key={row}>{row}<span>12 min</span></div>)}<footer><i /><i /><i /><i /></footer></div>; }

function CinematicDeck({ appDestination }) {
  const [active, setActive] = useState(0);
  const tapTimerRef = useRef(null);
  const lastTapRef = useRef(0);
  const scenes = [
    { eyebrow: "Roadside response, rethought", lead: "When the road stops,", accent: "Wingman starts.", body: "One connected workspace for the driver, the people doing the work, and the parts that keep it moving.", number: "00", label: "The signal begins", visual: "road", theme: "carbon", layout: "hero" },
    { eyebrow: "A clearer way forward", lead: "Help should", accent: "feel close.", body: "Start from where you are. Wingman turns a stressful stop into a nearby response you can understand at a glance.", number: "01", label: "Help nearby", visual: "locate", theme: "porcelain", layout: "center", product: "nearby" },
    { eyebrow: "The owner request", lead: "Share the", accent: "real situation.", body: "Details before the decision.", number: "02", label: "Request ready", visual: "road", theme: "gunmetal", layout: "hero", product: "request" },
    { eyebrow: "Service mode visible", lead: "See the", accent: "right response.", body: "See whether a mechanic has the part you need and can come to you, or whether it makes more sense to bring the vehicle in.", number: "03", label: "Match with clarity", visual: "locate", theme: "aluminum", layout: "lower", product: "match" },
    { eyebrow: "Progress connected", lead: "Stay close", accent: "to the repair.", body: "", number: "04", label: "Repair timeline", visual: "loop", theme: "gunmetal", layout: "split", product: "timeline" },
    { eyebrow: "For mechanics", lead: "Take the work", accent: "that fits.", body: "Review nearby requests, then accept only the mobile visits, shop jobs, or scheduled service you can take on.", number: "05", label: "Mechanic workspace", visual: "loop", theme: "aluminum", layout: "right", product: "queue" },
    { eyebrow: "Parts, in the same workspace", lead: "Source the part", accent: "without leaving the job.", body: "", number: "06", label: "Parts ordering", visual: "signal", theme: "gunmetal", layout: "split", product: "warehouse" },
    { eyebrow: "Built for the next move", lead: "From roadside", accent: "to routine care.", body: "", number: "07", label: "Service booking", visual: "final", theme: "porcelain", layout: "center", product: "schedule" },
    { eyebrow: "The demo network", lead: "Every response", accent: "has a route.", body: "Today, the public demo shows a seeded provider network around Richmond, Virginia, clearly labelled so the experience stays honest.", number: "08", label: "Richmond demo", visual: "map", theme: "carbon", layout: "hero" },
  ];

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["ArrowRight", "ArrowDown", " ", "Enter"].includes(event.key)) { event.preventDefault(); setActive((value) => Math.min(value + 1, scenes.length - 1)); }
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  const advance = (event) => {
    if (event.target.closest("a, button, input, textarea, select")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 330) {
      clearTimeout(tapTimerRef.current);
      lastTapRef.current = 0;
      setActive((value) => Math.max(value - 1, 0));
      return;
    }
    lastTapRef.current = now;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      setActive((value) => Math.min(value + 1, scenes.length - 1));
      lastTapRef.current = 0;
    }, 250);
  };
  return (
    <main className="wingman-deck h-[100svh] overflow-hidden bg-[#173e31] text-[#f6f3eb]" onClick={advance} onWheel={(event) => event.preventDefault()}>
      {scenes.map((scene, index) => <DeckScene key={scene.number} scene={scene} index={index} active={index === active} appDestination={appDestination} onNavigate={setActive} />)}
    </main>
  );
}

function DeckScene({ scene, index, active, appDestination, onNavigate }) {
  const style = { pointerEvents: active ? "auto" : "none" };
  return (
    <section className={`wingman-deck-scene wingman-deck-${scene.visual} wingman-deck-${scene.theme} wingman-deck-layout-${scene.layout} wingman-deck-product-${scene.product || "none"} ${active ? "is-active" : ""}`} style={style} aria-hidden={!active}>
      <div className="wingman-deck-grid" aria-hidden="true" />
      <div className="wingman-deck-glow wingman-deck-glow-a" aria-hidden="true" />
      <div className="wingman-deck-glow wingman-deck-glow-b" aria-hidden="true" />
      <DeckVisual type={scene.visual} />
      {scene.product && <DeckProductMoment type={scene.product} />}
      <nav className="relative z-20 mx-auto flex max-w-[1540px] items-center justify-between px-5 py-6 md:px-10 md:py-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Wingman home"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/25 bg-white/10"><Navigation size={17} fill="currentColor" /></span><span className="text-xl font-black tracking-[-.07em]">wingman</span></Link>
        <div className="hidden gap-8 text-sm font-semibold opacity-70 md:flex"><button type="button" onClick={() => onNavigate(1)} className="transition hover:opacity-100">How it works</button><button type="button" onClick={() => onNavigate(8)} className="transition hover:opacity-100">The network</button><Link to="/login" className="transition hover:opacity-100">Sign in</Link></div>
        <Link to={appDestination} className="rounded-full bg-[#cbff78] px-5 py-2.5 text-sm font-bold text-[#173e31]">Explore the demo <ArrowUpRight className="ml-1 inline" size={15} /></Link>
      </nav>
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-92px)] max-w-[1540px] flex-col justify-between px-5 pb-8 pt-8 md:px-10 md:pt-12">
        {scene.product === "timeline" ? <div className="wingman-deck-timeline-heading"><h1><span>Stay close</span><span>to the repair.</span></h1></div> : <div className="max-w-[1030px]"><p className="wingman-kicker text-[#cbff78]">{scene.eyebrow}</p><h1 className="mt-5 text-[clamp(3.6rem,8.2vw,9.2rem)] font-black leading-[.8] tracking-[-.095em]"><span className="block">{scene.lead}</span><span className="block text-[#cbff78]">{scene.accent}</span></h1><p className="mt-6 max-w-md text-sm leading-6 text-white/70 md:text-base md:leading-7">{scene.body}</p></div>}
      </div>
    </section>
  );
}

function DeckVisual({ type }) {
  if (type === "loop" || type === "signal") return <div className="wingman-deck-orbit" aria-hidden="true"><span>{type === "loop" ? <Wrench size={28} /> : <Navigation size={28} />}</span><i /><i /><i /></div>;
  if (type === "map") return <svg className="wingman-deck-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true"><path id="deck-map-road" d="M-80 720C250 700 225 174 612 340c280 120 302 375 830 70" /><path className="wingman-deck-route-dash" d="M-80 720C250 700 225 174 612 340c280 120 302 375 830 70" /><g className="wingman-deck-car"><rect x="-11" y="-7" width="22" height="14" rx="4" /><circle cx="-6" cy="8" r="3" /><circle cx="6" cy="8" r="3" /><animateMotion dur="10s" repeatCount="indefinite" rotate="auto"><mpath href="#deck-map-road" /></animateMotion></g></svg>;
  return <svg className="wingman-deck-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true"><path id={`deck-road-${type}`} d="M-90 720C170 600 276 294 510 448c190 126 300-170 497 20 160 154 275 28 545-197" /><path className="wingman-deck-route-dash" d="M-90 720C170 600 276 294 510 448c190 126 300-170 497 20 160 154 275 28 545-197" /><g className="wingman-deck-car"><rect x="-11" y="-7" width="22" height="14" rx="4" /><circle cx="-6" cy="8" r="3" /><circle cx="6" cy="8" r="3" /><animateMotion dur="14s" repeatCount="indefinite" rotate="auto"><mpath href={`#deck-road-${type}`} /></animateMotion></g></svg>;
}

function DeckProductMoment({ type }) {
  if (type === "nearby") return <div className="wingman-product wingman-product-nearby" aria-hidden="true"><div className="wingman-nearby-radar"><i className="wingman-radar-ring ring-one" /><i className="wingman-radar-ring ring-two" /><i className="wingman-radar-ring ring-three" /><i className="wingman-radar-scan" /><span className="wingman-radar-hub"><Navigation size={18} fill="currentColor" /></span><span className="wingman-radar-contact is-primary"><Wrench size={15} /></span><span className="wingman-radar-contact contact-one" /><span className="wingman-radar-contact contact-two" /><span className="wingman-radar-distance">1.2 mi</span></div><article><span>Nearby response</span><b>Reed Auto Works</b><p><CircleDot size={14} fill="currentColor" /> Available now · 1.2 mi</p></article></div>;
  if (type === "request") return <div className="wingman-product wingman-product-request" aria-hidden="true"><div className="wingman-request-case"><div className="wingman-request-head"><span>Assistance case · 024</span><b>Request ready</b></div><div className="wingman-request-row"><Navigation size={18} /><div><small>Current location</small><strong>Richmond, VA</strong></div><em>Shared</em></div><div className="wingman-request-row"><CarFront size={18} /><div><small>Vehicle</small><strong>2021 BMW 330i</strong></div><em>Added</em></div><div className="wingman-request-row is-issue"><Wrench size={18} /><div><small>What happened</small><strong>Battery will not start</strong></div><em>Sent</em></div><div className="wingman-request-stamp">Ready to assess</div></div></div>;
  if (type === "match") return <div className="wingman-product wingman-product-match" aria-hidden="true"><div className="wingman-product-kicker">Matching the next move</div><div className="wingman-match-cards"><article className="wingman-product-card is-muted"><span>Mobile service</span><b>Avery Auto Care</b><p>Battery <i>out of stock</i></p></article><article className="wingman-product-card is-selected"><span>Shop · Electrical</span><b>Reed Auto Works</b><p>Battery <strong>4 in stock</strong></p><em>1.2 mi · bring vehicle in</em></article></div></div>;
  if (type === "timeline") return <div className="wingman-product wingman-product-timeline" aria-hidden="true"><div className="wingman-road-timeline"><div className="wingman-road-lane"><i /><i /><i /><i /><i /><i /></div><div className="wingman-timeline-line"><span className="is-done"><i><CarFront size={19} /></i><b>Requested</b></span><span className="is-done"><i><Truck size={19} /></i><b>Accepted</b></span><span className="is-done"><i><Car size={19} /></i><b>In progress</b></span><span><i><Bike size={19} /></i><b>Completed</b></span></div></div></div>;
  if (type === "queue") return <div className="wingman-product wingman-product-queue" aria-hidden="true"><div className="wingman-queue-top"><span>Today’s queue</span><b>3 live</b></div>{[["Battery fault", "Needs attention"], ["Flat tire", "In queue"], ["Oil service", "Booked"]].map(([job, status], index) => <article className={index === 0 ? "is-priority" : ""} key={job}><span className="wingman-queue-number">0{index + 1}</span><b>{job}</b><em>{status}</em></article>)}</div>;
  if (type === "warehouse") return <div className="wingman-product wingman-product-warehouse" aria-hidden="true"><div className="wingman-warehouse-flow"><article className="wingman-flow-origin"><Package size={25} /><span>Warehouse stock</span><b>Blue Ridge Parts</b><small>6 terminal kits available</small></article><div className="wingman-flow-route"><i className="wingman-flow-line" /><div className="wingman-flow-cargo"><Package size={19} /><span>Battery terminal kit</span></div><div className="wingman-flow-stages">{["Requested", "Quoted", "Confirmed", "Packed", "Delivered"].map((status, index) => <span className={index < 3 ? "is-done" : ""} key={status}><i />{status}</span>)}</div></div></div></div>;
  if (type === "health") return <div className="wingman-product wingman-product-health" aria-hidden="true"><div className="wingman-health-dial"><div><b>8,200</b><span>mi since last service</span></div></div><article className="wingman-health-note"><Pencil size={18} /><span>Vehicle note</span><p>Noticed a rattle near the left wheel.</p><i /></article></div>;
  if (type === "schedule") {
    const days = Array.from({ length: 30 }, (_, index) => String(index + 1));
    return <div className="wingman-product wingman-product-schedule" aria-hidden="true"><div className="wingman-calendar-head"><span>Schedule service</span><b>June 2026</b></div><div className="wingman-calendar-week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div className="wingman-calendar-days">{days.map((day) => <span className={day === "17" ? "is-selected" : day === "19" ? "has-note" : ""} key={day}><b>{day}</b></span>)}</div><div className="wingman-calendar-notes"><article><span>Tue, Jun 17 · 10:30 AM</span><b>BMW Richmond · Service appointment</b></article><article><span>Thu, Jun 19 · 2:00 PM</span><b>Northside Tire · Tire check</b></article></div></div>;
  }
  return null;
}

function CinematicForward() {
  const sceneRef = useRef(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);
  const scenes = [
    {
      number: "01",
      word: "Locate.",
      eyebrow: "A clearer way forward",
      title: "Help should feel close.",
      copy: "Share the location, vehicle, and what happened once. Wingman turns a stressful stop into a signal the network can use.",
      note: "Signal received · roadside",
    },
    {
      number: "02",
      word: "Match.",
      eyebrow: "The next right hand",
      title: "Context gets there first.",
      copy: "Available mechanics see a usable request, not a vague call. The location, vehicle, and problem arrive together.",
      note: "Best-fit mechanic · 1.2 mi",
    },
    {
      number: "03",
      word: "Move.",
      eyebrow: "A connected response",
      title: "Keep every handoff moving.",
      copy: "If a repair needs stock, the warehouse enters the same picture. Progress stays visible from the road to resolution.",
      note: "Parts visibility · active",
    },
  ];

  useEffect(() => {
    const onScroll = () => {
      const node = sceneRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const travel = Math.max(1, node.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(0.999, -rect.top / travel));
      const next = Math.min(2, Math.floor(progress * 3));
      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scene = scenes[phase];

  return (
    <section id="how-it-works" ref={sceneRef} className={`wingman-forward wingman-forward-phase-${phase} relative h-[250svh] bg-[#f6f4ed]`}>
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden">
        <div className="wingman-forward-grid" aria-hidden="true" />
        <div className="wingman-forward-orb wingman-forward-orb-one" aria-hidden="true" />
        <div className="wingman-forward-orb wingman-forward-orb-two" aria-hidden="true" />
        <svg className="wingman-forward-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
          <path id="wingman-forward-path" className="wingman-forward-motion-path" d="M-80 715C190 555 340 792 510 530S810 166 989 372s310 108 540-146" />
          <path className="wingman-forward-route-base" d="M-80 715C190 555 340 792 510 530S810 166 989 372s310 108 540-146" />
          <path className="wingman-forward-route-dash" d="M-80 715C190 555 340 792 510 530S810 166 989 372s310 108 540-146" />
          <g className="wingman-forward-vehicle"><rect x="-10" y="-6" width="20" height="13" rx="4" /><circle cx="-6" cy="7" r="2.6" /><circle cx="6" cy="7" r="2.6" /><animateMotion dur="12s" repeatCount="indefinite" rotate="auto"><mpath href="#wingman-forward-path" /></animateMotion></g>
        </svg>

        <div className="relative mx-auto grid w-full max-w-[1540px] gap-10 px-5 py-16 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div className="self-center">
            <p className="wingman-kicker text-[#53765a]">{scene.eyebrow}</p>
            <p className="wingman-forward-word" aria-hidden="true">{scene.word}</p>
            <h2 key={scene.title} className="wingman-forward-title">{scene.title}</h2>
            <p key={scene.copy} className="wingman-forward-copy">{scene.copy}</p>
          </div>

          <div className="wingman-forward-readout" key={scene.number}>
            <div className="flex items-center justify-between border-b border-[#173e31]/15 pb-4">
              <span className="font-mono text-sm text-[#3a694b]">{scene.number}/03</span>
              <span className="text-xs font-bold uppercase tracking-[.17em] text-[#426248]">Response signal</span>
            </div>
            <div className="relative mt-8 min-h-[260px] overflow-hidden">
              <span className="wingman-forward-index">{scene.number}</span>
              <div className="wingman-forward-marker"><span /><span /><span /></div>
              <p className="relative z-10 mt-28 max-w-sm text-2xl font-black leading-[.92] tracking-[-.06em] text-[#173e31] md:text-4xl">{scene.note}</p>
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-[#173e31]/15 pt-4 text-xs font-bold uppercase tracking-[.16em] text-[#54705c]"><span>Wingman network</span><span>{phase === 0 ? "Live location" : phase === 1 ? "Handoff ready" : "Route intact"}</span></div>
            </div>
          </div>
        </div>
        <div className="wingman-forward-progress" aria-hidden="true"><span className={phase >= 0 ? "is-active" : ""} /><span className={phase >= 1 ? "is-active" : ""} /><span className={phase >= 2 ? "is-active" : ""} /></div>
      </div>
    </section>
  );
}

function ResponseJourney() {
  const stageRef = useRef(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const chapters = [
    { label: "Driver", title: "A signal leaves the roadside.", copy: "A driver shares a location, vehicle, and the problem, not a loose collection of calls and texts.", icon: <Navigation size={18} />, tone: "lime" },
    { label: "Mechanic", title: "The right hands see the full picture.", copy: "Available mechanics receive a usable case: where, what, when, and what the vehicle needs next.", icon: <Wrench size={18} />, tone: "blue" },
    { label: "Warehouse", title: "Parts become part of the response.", copy: "When the repair needs stock, the network can surface the right inventory and keep fulfillment visible.", icon: <Package size={18} />, tone: "orange" },
  ];

  useEffect(() => {
    const onScroll = () => {
      const node = stageRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const travel = Math.max(1, node.offsetHeight - window.innerHeight);
      const next = Math.min(2, Math.floor(Math.max(0, Math.min(.999, -rect.top / travel)) * RESPONSE_STAGE_COUNT));
      if (next !== activeRef.current) { activeRef.current = next; setActive(next); }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const chapter = chapters[active];

  return (
    <section id="response-loop" ref={stageRef} className={`wingman-loop wingman-loop-${chapter.tone} relative h-[250svh] bg-[#173e31] text-[#f6f3eb]`}>
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden">
        <div className="wingman-journey-grid" aria-hidden="true" />
        <svg className="wingman-journey-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true"><path d="M-80 700C240 730 245 188 612 330c253 97 220 437 702 134" /><path className="wingman-journey-route-dash" d="M-80 700C240 730 245 188 612 330c253 97 220 437 702 134" /></svg>
        <div className="relative mx-auto grid w-full max-w-[1540px] gap-10 px-5 py-16 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><p className="wingman-kicker text-[var(--journey-accent)]">The response loop</p><h2 className="mt-5 max-w-md text-5xl font-black leading-[.87] tracking-[-.075em] md:text-7xl">Built to keep<br />help moving.</h2><p className="mt-7 max-w-sm text-base leading-7 text-white/62">The important part is not another dashboard. It is one live signal that gets clearer as the right people enter the response.</p></div>
          <div key={chapter.label} className="wingman-loop-stage">
            <div className="wingman-loop-ring"><span className="wingman-loop-core">{chapter.icon}</span><i /><i /><i /></div>
            <div className="wingman-loop-copy"><div className="flex items-center gap-3 text-[var(--journey-accent)]"><span className="font-mono text-sm">0{active + 1}</span><span className="h-px w-10 bg-current" /><span className="wingman-kicker">{chapter.label}</span></div><h3 className="mt-6 max-w-2xl text-4xl font-black leading-[.88] tracking-[-.07em] md:text-6xl">{chapter.title}</h3><p className="mt-6 max-w-xl text-base leading-7 text-white/65 md:text-lg">{chapter.copy}</p></div>
          </div>
        </div>
        <div className="wingman-forward-progress" aria-hidden="true"><span className={active >= 0 ? "is-active" : ""} /><span className={active >= 1 ? "is-active" : ""} /><span className={active >= 2 ? "is-active" : ""} /></div>
      </div>
    </section>
  );
}

function SharedFieldCarousel() {
  const [panel, setPanel] = useState(-1);
  const roles = [
    { index: "01", label: "For drivers", copy: "Find the next best move, share the details, and stay close to the response.", icon: <CarFront size={28} />, accent: "lime", signal: "Location → response" },
    { index: "02", label: "For mechanics", copy: "Turn incoming requests into clear work, route context, and a live job timeline.", icon: <Wrench size={28} />, accent: "blue", signal: "Request → repair" },
    { index: "03", label: "For warehouses", copy: "Keep the right part visible at the right moment, from stock to fulfillment.", icon: <Package size={28} />, accent: "orange", signal: "Stock → fulfillment" },
  ];
  const current = panel >= 0 ? roles[panel] : null;

  return (
    <section id="shared-field" className={`wingman-scene wingman-field wingman-field-${current?.accent || "intro"} relative flex min-h-[100svh] items-center overflow-hidden bg-[#f6f4ed] px-5 py-16 md:px-10`}>
      <div className="wingman-field-grid" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1540px]">
        {panel < 0 ? (
          <div key="intro" className="wingman-field-enter grid min-h-[68svh] items-center gap-12 lg:grid-cols-[1fr_.8fr]">
            <div><p className="wingman-kicker text-[#42643a]">A shared field of view</p><h2 className="mt-5 max-w-3xl text-6xl font-black leading-[.85] tracking-[-.08em] text-[#173e31] md:text-8xl">One signal.<br />Every handoff.</h2></div>
            <div className="lg:justify-self-end"><p className="max-w-md text-lg leading-8 text-[#617168]">Wingman brings the people who solve the problem into the same response loop, without adding another dashboard to decode.</p><button type="button" onClick={() => setPanel(0)} className="wingman-field-next mt-10 ml-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#173e31] text-[#cbff78] transition hover:scale-110 hover:bg-[#285b44]" aria-label="Show driver workflow"><ChevronRight size={33} /></button></div>
          </div>
        ) : (
          <div key={current.index} className="wingman-field-enter grid min-h-[68svh] items-center gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <div className="wingman-field-signal relative flex min-h-[330px] items-center justify-center overflow-hidden rounded-[2rem] bg-[#173e31] p-8 text-[var(--field-accent)]"><div className="wingman-field-orbit"><i /><i /><i /><span>{current.icon}</span></div><div className="absolute bottom-7 left-7 right-7 flex items-center justify-between border-t border-white/15 pt-4 text-xs font-bold uppercase tracking-[.16em] text-white/55"><span>{current.signal}</span><span>{current.index}/03</span></div></div>
            <div className="relative lg:pl-10"><p className="wingman-kicker text-[var(--field-accent)]">{current.index} · {current.label}</p><h3 className="mt-6 max-w-3xl text-6xl font-black leading-[.85] tracking-[-.08em] text-[#173e31] md:text-8xl">{current.label.replace("For ", "")},<br />in the loop.</h3><p className="mt-7 max-w-xl text-lg leading-8 text-[#617168]">{current.copy}</p><div className="mt-10 flex items-center gap-4"><button type="button" onClick={() => setPanel((value) => value - 1)} className="flex h-14 w-14 items-center justify-center rounded-full border border-[#173e31]/20 text-[#173e31] transition hover:bg-[#173e31] hover:text-white" aria-label="Previous response role"><ChevronLeft size={24} /></button>{panel < roles.length - 1 ? <button type="button" onClick={() => setPanel((value) => value + 1)} className="wingman-field-next flex h-20 w-20 items-center justify-center rounded-full bg-[#173e31] text-[var(--field-accent)] transition hover:scale-110 hover:bg-[#285b44]" aria-label="Next response role"><ChevronRight size={33} /></button> : <div className="flex gap-2" aria-label="Final role in the response loop"><span className="h-2 w-9 rounded-full bg-[#173e31]" /><span className="h-2 w-9 rounded-full bg-[#173e31]" /><span className="h-2 w-9 rounded-full bg-[var(--field-accent)]" /></div>}</div></div>
          </div>
        )}
      </div>
    </section>
  );
}

function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".wingman-reveal");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("wingman-reveal-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.16 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
