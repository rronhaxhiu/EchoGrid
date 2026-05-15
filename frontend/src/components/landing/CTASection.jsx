import { ArrowRight, Rocket } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { SectionContainer } from "@/components/landing/SectionContainer";

export function CTASection() {
  return (
    <SectionContainer
      centered
      className="bg-white dark:bg-[#02050c]"
      contentClassName="relative"
      id="cta"
    >
      <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/18 blur-[120px] dark:bg-cyan-400/10" />
      <motion.div
        className="relative mx-auto max-w-4xl rounded-xl border border-slate-950/10 bg-white/70 px-6 py-16 text-center shadow-2xl shadow-slate-900/5 backdrop-blur-2xl dark:border-white/12 dark:bg-white/[0.06] dark:shadow-black/30 sm:px-10 lg:px-16"
        initial={{ opacity: 0, y: 36, filter: "blur(14px)" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-120px" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-emerald-400/30 bg-emerald-300/15 text-emerald-600 shadow-[0_0_42px_rgba(52,211,153,0.22)] dark:text-emerald-200">
          <Rocket className="size-6" />
        </span>
        <h2 className="mt-7 text-4xl font-light leading-tight text-slate-950 sm:text-6xl dark:text-white">
          Start shaping the next scenario.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300/78">
          Launch the first simulation surface, connect it to live backend runs,
          and evolve Ecogrid into an interactive planetary model.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-50"
            size="lg"
          >
            <a href="#home">
              Launch Simulation
              <ArrowRight className="size-4" />
            </a>
          </Button>
          <Button
            asChild
            className="h-11 rounded-full border-slate-950/10 bg-white/55 px-5 text-slate-950 hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.14]"
            size="lg"
            variant="outline"
          >
            <a href="#about">Learn More</a>
          </Button>
        </div>
      </motion.div>
    </SectionContainer>
  );
}
