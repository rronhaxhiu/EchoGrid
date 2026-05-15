import { motion } from "framer-motion";

import { GlassCard } from "@/components/landing/GlassCard";
import { SectionContainer } from "@/components/landing/SectionContainer";
import { Separator } from "@/components/ui/separator";
import { aboutHighlights } from "@/data/landingContent";

export function AboutSection() {
  return (
    <SectionContainer
      className="bg-white text-slate-950 dark:bg-[#02050c]"
      contentClassName="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]"
      description="Ecogrid turns simulation state into a planetary interface. Global trends stay readable at distance while tile-level environmental relationships can surface when the user moves closer."
      eyebrow="About Ecogrid"
      id="about"
      title="A living model of environmental change."
    >
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_center,rgba(15,23,42,0.12)_1px,transparent_1.5px)] [background-size:80px_80px] dark:opacity-30 dark:[background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.32)_1px,transparent_1.5px)]" />
      <motion.div
        className="relative lg:pt-24"
        initial={{ opacity: 0, x: 28, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-120px" }}
      >
        <GlassCard className="rounded-xl p-5 sm:p-6" tone="emerald">
          <div className="grid gap-5 sm:grid-cols-[0.75fr_1fr]">
            <div className="relative aspect-square min-h-56 overflow-hidden rounded-lg border border-slate-950/10 bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.42),transparent_35%),radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.22),transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.02))] dark:border-white/10 dark:bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.36),transparent_34%),radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.28),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
              <div className="absolute inset-8 rounded-full border border-cyan-300/35 shadow-[0_0_70px_rgba(34,211,238,0.30)]" />
              <div className="absolute inset-14 rounded-full border border-emerald-300/35" />
              <div className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 shadow-[0_0_50px_rgba(34,211,238,0.30)] dark:bg-white/90" />
              <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(30deg,rgba(34,211,238,0.26)_12%,transparent_12.5%,transparent_87%,rgba(34,211,238,0.26)_87.5%,rgba(34,211,238,0.26)),linear-gradient(150deg,rgba(16,185,129,0.22)_12%,transparent_12.5%,transparent_87%,rgba(16,185,129,0.22)_87.5%,rgba(16,185,129,0.22))] [background-size:54px_94px]" />
            </div>
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Simulation state
                </p>
                <h3 className="mt-3 text-2xl font-light text-slate-950 dark:text-white">
                  Planetary signals without dashboard clutter.
                </h3>
              </div>
              <div className="grid gap-3">
                {aboutHighlights.map((item) => (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300" key={item}>
                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                    {item}
                  </div>
                ))}
              </div>
              <Separator className="bg-slate-950/10 dark:bg-white/10" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">
                The landing page keeps this direction visible now while leaving a
                clean replacement path for the future 3D globe and live metrics.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </SectionContainer>
  );
}
