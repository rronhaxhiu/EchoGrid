import { motion } from "framer-motion";

import { GlassCard } from "@/components/landing/GlassCard";
import { LandingIcon } from "@/components/landing/landingIconMap";
import { cn } from "@/lib/utils";

const toneText = {
  emerald: "text-emerald-600 dark:text-emerald-200",
  cyan: "text-cyan-600 dark:text-cyan-200",
  blue: "text-blue-600 dark:text-blue-200",
  amber: "text-amber-600 dark:text-amber-200",
  rose: "text-rose-600 dark:text-rose-200",
  violet: "text-violet-600 dark:text-violet-200",
};

export function FeatureCard({ feature, index }) {
  const isOdd = index % 2 === 1;

  return (
    <motion.div
      className={cn("grid gap-5 md:grid-cols-2", isOdd && "md:[&>*:first-child]:order-2")}
      initial={{ opacity: 0, y: 32, filter: "blur(12px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: "-120px" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    >
      <GlassCard className="rounded-xl p-6" tone={feature.tone}>
        <div className="flex h-full min-h-52 flex-col justify-between">
          <div>
            <span
              className={cn(
                "grid size-12 place-items-center rounded-lg bg-slate-950/[0.04] dark:bg-white/[0.08]",
                toneText[feature.tone],
              )}
            >
              <LandingIcon className="size-6" name={feature.icon} />
            </span>
            <h3 className="mt-6 text-2xl font-light text-slate-950 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300/76">
              {feature.description}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="rounded-xl p-6" tone={feature.tone}>
        <div className="flex min-h-52 flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Signal
              </p>
              <p className="mt-3 text-5xl font-extralight text-slate-950 dark:text-white">
                {feature.metric}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border border-current/20 px-3 py-1 text-xs",
                toneText[feature.tone],
              )}
            >
              Live layer
            </span>
          </div>
          <div>
            <div className="mb-4 grid grid-cols-8 gap-2">
              {Array.from({ length: 24 }).map((_, itemIndex) => (
                <span
                  className={cn(
                    "h-10 rounded-sm bg-slate-950/[0.08] dark:bg-white/[0.08]",
                    itemIndex % 4 === 0 && "bg-cyan-400/35 dark:bg-cyan-300/28",
                    itemIndex % 5 === 0 && "bg-emerald-400/35 dark:bg-emerald-300/28",
                  )}
                  key={`${feature.title}-${itemIndex}`}
                />
              ))}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{feature.caption}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
