import { motion } from "framer-motion";

import { GlassCard } from "@/components/landing/GlassCard";
import { SectionContainer } from "@/components/landing/SectionContainer";
import { stats } from "@/data/landingContent";

export function StatsSection() {
  return (
    <SectionContainer
      centered
      className="bg-slate-50 dark:bg-[#040914]"
      description="High-level indicators keep the landing page product-focused while the backend simulation APIs continue to grow."
      eyebrow="Metrics"
      id="stats"
      title="Floating metrics for a planetary engine."
    >
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            key={stat.label}
            transition={{ duration: 0.62, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, margin: "-120px" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          >
            <GlassCard className="rounded-xl p-6 text-center" tone={index % 2 ? "emerald" : "cyan"}>
              <p className="text-5xl font-extralight text-slate-950 dark:text-white">
                {stat.value}
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300/76">
                {stat.label}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </SectionContainer>
  );
}
