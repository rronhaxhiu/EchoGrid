import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/landing/GlassCard";
import { LandingIcon } from "@/components/landing/landingIconMap";
import { cn } from "@/lib/utils";

const toneClasses = {
  emerald:
    "border-emerald-400/28 bg-emerald-300/14 text-emerald-600 shadow-emerald-400/20 dark:text-emerald-200",
  cyan:
    "border-cyan-400/28 bg-cyan-300/14 text-cyan-600 shadow-cyan-400/20 dark:text-cyan-200",
  violet:
    "border-violet-400/28 bg-violet-300/14 text-violet-600 shadow-violet-400/20 dark:text-violet-200",
};

export function ActionCard({ title, icon, href, tone = "cyan", index = 0 }) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 34, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.75, delay: 0.12 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.015 }}
    >
      <GlassCard
        tone={tone}
        className="group h-full min-h-56 cursor-pointer rounded-xl bg-white/88 px-6 py-7 text-center ring-1 ring-slate-950/[0.04] hover:border-white/70 hover:bg-white/95 hover:shadow-cyan-500/10 dark:bg-slate-950/75 dark:ring-white/[0.04] dark:hover:border-white/25 dark:hover:bg-slate-950/88"
      >
        <a className="flex h-full min-h-44 cursor-pointer flex-col items-center justify-between" href={href}>
          <div>
            <div
              className={cn(
                "mx-auto grid size-20 cursor-pointer place-items-center rounded-full border shadow-[0_0_54px_currentColor] transition duration-300 group-hover:scale-105",
                toneClasses[tone],
              )}
            >
              <LandingIcon name={icon} className="size-9" />
            </div>
            <h3 className="mt-7 text-xl font-medium text-slate-950 dark:text-white">
              {title}
            </h3>
          </div>
          <Button
            size="icon-lg"
            variant="outline"
            className="mt-6 cursor-pointer rounded-full border-slate-950/10 bg-white/75 text-slate-950 shadow-lg backdrop-blur-xl hover:bg-white dark:border-white/15 dark:bg-white/[0.14] dark:text-white dark:hover:bg-white/[0.22]"
            type="button"
          >
            <ArrowRight className="size-4 transition duration-300 group-hover:translate-x-0.5" />
          </Button>
        </a>
      </GlassCard>
    </motion.div>
  );
}
