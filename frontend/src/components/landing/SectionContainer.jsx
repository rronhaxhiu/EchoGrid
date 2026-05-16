import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectionContainer({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  contentClassName,
  centered = false,
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden px-5 py-24 sm:px-8 lg:px-10 lg:py-32",
        className,
      )}
    >
      <div className={cn("mx-auto w-full max-w-7xl", contentClassName)}>
        {(eyebrow || title || description) && (
          <motion.div
            className={cn("max-w-3xl", centered && "mx-auto text-center")}
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {eyebrow && (
              <Badge
                variant="outline"
                className="h-auto border-cyan-400/25 bg-cyan-200/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100"
              >
                {eyebrow}
              </Badge>
            )}
            {title && (
              <h2 className="mt-5 text-4xl font-light leading-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300/78">
                {description}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}
