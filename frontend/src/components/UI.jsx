export function StatusBadge({ status }) {
  const styles = {
    requested:   "bg-[#e8e6df] text-[#3b454c] border border-[#aeb8bc]",
    accepted:    "bg-[#c9d0d3] text-[#252a2e] border border-[#aeb8bc]",
    in_progress: "bg-[#3b454c] text-[#f4f1ea] border border-[#3b454c]",
    completed:   "bg-[#252a2e] text-[#f4f1ea] border border-[#252a2e]",
    cancelled:   "bg-[#e8e6df] text-[#59646a] border border-[#c9d0d3]",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || "bg-[#e8e6df] text-[#59646a] border border-[#c9d0d3]"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-[#f4f1ea] rounded-xl border border-[#c9d0d3] shadow-[0_10px_28px_rgba(37,42,46,0.08)] ${className}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-[#3b454c] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-gray-600 font-medium">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
