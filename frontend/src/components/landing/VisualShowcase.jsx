import { motion } from "framer-motion";

import { PreviewPanel } from "@/components/landing/PreviewPanel";
import { SectionContainer } from "@/components/landing/SectionContainer";
import { showcasePanels } from "@/data/landingContent";

export function VisualShowcase() {
  return (
    <SectionContainer
      centered
      className="bg-white dark:bg-[#02050c]"
      description="The showcase uses replaceable preview cards so future screenshots, globe renders, dashboards, and simulation UI states can be dropped in without rebuilding the section."
      eyebrow="Visual Showcase"
      id="history"
      title="A product surface ready for live simulations."
    >
      <div className="relative mt-16 min-h-[680px]">
        <div className="absolute left-1/2 top-16 h-[28rem] w-[min(58rem,100%)] -translate-x-1/2 rounded-[50%] border border-cyan-400/20 bg-[radial-gradient(circle_at_50%_46%,rgba(14,165,233,0.22),transparent_40%),radial-gradient(circle_at_45%_52%,rgba(16,185,129,0.18),transparent_44%)] shadow-[0_0_110px_rgba(34,211,238,0.16)]" />
        <div className="absolute inset-x-0 top-20 mx-auto h-[32rem] max-w-5xl opacity-35 [background-image:linear-gradient(30deg,rgba(34,211,238,0.28)_12%,transparent_12.5%,transparent_87%,rgba(34,211,238,0.28)_87.5%,rgba(34,211,238,0.28)),linear-gradient(150deg,rgba(16,185,129,0.22)_12%,transparent_12.5%,transparent_87%,rgba(16,185,129,0.22)_87.5%,rgba(16,185,129,0.22))] [background-size:68px_118px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />

        <div className="relative grid gap-5 lg:grid-cols-3 lg:items-start">
          {showcasePanels.map((panel, index) => (
            <motion.div
              className={index === 1 ? "lg:mt-32" : index === 2 ? "lg:mt-14" : ""}
              initial={{ opacity: 0, y: 42, filter: "blur(14px)" }}
              key={panel.title}
              transition={{
                duration: 0.72,
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true, margin: "-120px" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            >
              <PreviewPanel {...panel} />
            </motion.div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
