import { GlassCard } from "@/components/landing/GlassCard";

export function PreviewPanel({ title, label, values, tone }) {
  return (
    <GlassCard className="rounded-xl p-5" tone={tone}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <h3 className="mt-2 text-xl font-light text-slate-950 dark:text-white">{title}</h3>
        </div>
        <span className="size-3 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]" />
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-950/10 bg-slate-950/[0.04] p-4 dark:border-white/10 dark:bg-white/[0.05]">
        <div className="relative aspect-[16/10] rounded-md bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.32),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.16),rgba(16,185,129,0.12))] dark:bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.28),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(16,185,129,0.08))]">
          <div className="absolute inset-5 rounded-full border border-cyan-300/35" />
          <div className="absolute inset-10 rounded-full border border-emerald-300/25" />
          <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2">
            {values.map((value) => (
              <span
                className="rounded-md border border-white/20 bg-white/55 px-2 py-1 text-[0.65rem] text-slate-700 backdrop-blur dark:bg-slate-950/45 dark:text-slate-200"
                key={value}
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
