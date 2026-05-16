import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/landing/ActionCard";
import { FloatingMetric } from "@/components/landing/FloatingMetric";
import { HeroGlobe } from "@/components/landing/HeroGlobe";
import { heroMetrics, landingActions } from "@/data/landingContent";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative flex min-h-[100svh] overflow-hidden px-5 pb-10 pt-24 sm:px-8 lg:px-10"
    >
      <HeroGlobe />
      <div className="pointer-events-none absolute inset-0 z-10">
        {heroMetrics.map((metric, index) => (
          <FloatingMetric key={metric.label} delay={index * 0.08} {...metric} />
        ))}
      </div>

      <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-col justify-center">
        <motion.div
          className="mx-auto mt-20 max-w-4xl text-center sm:mt-28 lg:mt-36"
          initial={{ opacity: 0, y: 30, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge
            variant="outline"
            className="h-auto border-cyan-300/30 bg-white/55 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-700 shadow-lg shadow-cyan-950/5 backdrop-blur-xl dark:bg-cyan-200/10 dark:text-cyan-100"
          >
            Planetary simulation interface
          </Badge>
          <h1 className="mt-6 text-6xl font-extralight leading-none text-slate-950 sm:text-8xl lg:text-9xl dark:text-white">
            Ecogrid
          </h1>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.38em] text-slate-600 sm:text-sm dark:text-cyan-100/72">
            Simulate. Analyze. Optimize.
          </p>
        </motion.div>

        <div className="mx-auto mt-10 grid w-full max-w-5xl items-stretch gap-5 md:grid-cols-3 lg:mt-12">
          {landingActions.map((action, index) => (
            <ActionCard key={action.title} index={index} {...action} />
          ))}
        </div>

        <motion.a
          animate={{ y: [0, 8, 0] }}
          className="mx-auto mt-10 hidden text-xs uppercase tracking-[0.26em] text-slate-500 dark:text-slate-300/68 sm:block"
          href="#about"
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          Scroll to explore
        </motion.a>
      </div>
    </section>
  );
}
