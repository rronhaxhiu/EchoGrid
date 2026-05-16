import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { LandingIcon } from "@/components/landing/landingIconMap";
import { cn } from "@/lib/utils";

const toneClasses = {
  emerald:
    "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
  cyan:
    "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200",
  violet:
    "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200",
};

const actionLabels = {
  "Launch Simulation": "Launch",
  History: "Open history",
  "View Team": "View team",
};

export function ActionCard({
  title,
  description,
  icon,
  href,
  tone = "cyan",
  index = 0,
}) {
  return (
    <motion.a
      aria-label={`${title}: ${description}`}
      className="group block h-full rounded-2xl outline-none transition duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cyan-200/70 dark:focus-visible:ring-offset-[#02050c]"
      href={href}
      initial={{ opacity: 0, y: 34, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.75, delay: 0.12 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
    >
      <Card className="h-full min-h-[15.5rem] cursor-pointer rounded-2xl border-white/55 bg-card/90 py-0 text-card-foreground shadow-lg shadow-slate-950/8 backdrop-blur-xl transition duration-300 group-hover:bg-card group-hover:shadow-xl group-hover:shadow-slate-950/12 dark:border-white/12 dark:bg-slate-950/82 dark:shadow-black/30 dark:group-hover:bg-slate-950/92">
        <CardContent className="flex h-full flex-col items-start p-5 sm:p-6">
          <span
            className={cn(
              "grid size-12 place-items-center rounded-xl transition duration-300 group-hover:scale-105",
              toneClasses[tone],
            )}
          >
            <LandingIcon name={icon} className="size-6" />
          </span>

          <div className="mt-5 text-left">
            <h3 className="text-xl font-medium text-slate-950 dark:text-white">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300/78">
              {description}
            </p>
          </div>

          <span
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "mt-auto rounded-lg bg-slate-950/85 text-white shadow-sm hover:bg-slate-950 dark:bg-white/88 dark:text-slate-950 dark:group-hover:bg-white",
            )}
          >
            {actionLabels[title] || "Open"}
            <ArrowRight
              className={cn(
                "size-3.5 transition duration-300 group-hover:translate-x-0.5",
                tone === "emerald" && "group-hover:text-emerald-500 dark:group-hover:text-emerald-200",
                tone === "cyan" && "group-hover:text-cyan-500 dark:group-hover:text-cyan-200",
                tone === "violet" && "group-hover:text-violet-500 dark:group-hover:text-violet-200",
              )}
            />
          </span>
        </CardContent>
      </Card>
    </motion.a>
  );
}
