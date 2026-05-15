export function MetricIndicator({ label, value, status, tone = "emerald" }) {
  const tones = {
    emerald: "border-emerald-300/35 text-emerald-200 shadow-emerald-400/20",
    cyan: "border-cyan-300/35 text-cyan-100 shadow-cyan-400/20",
    amber: "border-amber-300/35 text-amber-100 shadow-amber-400/20",
    rose: "border-rose-300/35 text-rose-100 shadow-rose-400/20",
  };

  return (
    <div className={`w-44 border-l pl-4 text-left shadow-2xl ${tones[tone]}`}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-100/76">
        {label}
      </p>
      <p className="mt-2 text-2xl font-light text-white">{value}</p>
      <p className="mt-1 text-xs">{status}</p>
    </div>
  );
}
