import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneGlow = {
  emerald: "before:bg-emerald-300/20 after:bg-emerald-400/10",
  green: "before:bg-lime-300/18 after:bg-emerald-400/10",
  cyan: "before:bg-cyan-300/18 after:bg-sky-400/10",
  blue: "before:bg-blue-300/18 after:bg-cyan-400/10",
  amber: "before:bg-amber-300/18 after:bg-orange-400/10",
  rose: "before:bg-rose-300/18 after:bg-orange-400/10",
  violet: "before:bg-violet-300/20 after:bg-fuchsia-400/10",
};

export function GlassCard({ children, className, tone = "cyan", ...props }) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-white/40 bg-white/70 text-slate-950 shadow-2xl shadow-slate-900/5 backdrop-blur-2xl transition duration-300 before:absolute before:-right-10 before:-top-10 before:size-28 before:rounded-full before:blur-3xl after:absolute after:-bottom-14 after:left-6 after:size-36 after:rounded-full after:blur-3xl dark:border-white/[0.14] dark:bg-slate-950/[0.46] dark:text-white dark:shadow-black/30",
        toneGlow[tone],
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/45 via-white/[0.08] to-transparent dark:from-white/[0.12] dark:via-white/[0.03]" />
      <div className="relative z-10">{children}</div>
    </Card>
  );
}
