import { motion } from "framer-motion";

import { GlassCard } from "@/components/landing/GlassCard";
import { LandingIcon } from "@/components/landing/landingIconMap";
import { cn } from "@/lib/utils";

const toneClasses = {
  emerald: "text-emerald-500 dark:text-emerald-300",
  green: "text-lime-500 dark:text-lime-300",
  cyan: "text-cyan-500 dark:text-cyan-200",
  blue: "text-blue-500 dark:text-blue-200",
  amber: "text-amber-500 dark:text-amber-200",
  rose: "text-rose-500 dark:text-rose-200",
  violet: "text-violet-500 dark:text-violet-200",
};

export function FloatingMetric({
  label,
  value,
  status,
  tone = "cyan",
  icon,
  className,
  delay = 0,
}) {
  return (
    <motion.div
      className={cn("pointer-events-none absolute z-20", className)}
      initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut" }}
      >
        <GlassCard
          tone={tone}
          className="w-48 rounded-lg border-slate-950/10 px-4 py-3 dark:border-white/[0.12]"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-8 place-items-center rounded-full bg-slate-950/[0.04] dark:bg-white/[0.08]",
                toneClasses[tone],
              )}
            >
              <LandingIcon name={icon} className="size-4" />
            </span>
            <span>
              <span className="block text-[0.64rem] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300/76">
                {label}
              </span>
              <span className="mt-1 block text-2xl font-light text-slate-950 dark:text-white">
                {value}
              </span>
              <span className={cn("mt-1 block text-xs", toneClasses[tone])}>
                {status}
              </span>
            </span>
          </div>
        </GlassCard>
        <span
          className={cn(
            "mx-auto mt-2 block h-14 w-px bg-gradient-to-b from-current to-transparent opacity-70",
            toneClasses[tone],
          )}
        />
      </motion.div>
    </motion.div>
  );
}
