import { ArrowRight, Box } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { landingActions, navItems } from "@/data/landingContent";
import { cn } from "@/lib/utils";

function useHeroPassed() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > window.innerHeight * 0.72);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isCompact;
}

export function StickyNavbar() {
  const isCompact = useHeroPassed();

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:px-6">
      <motion.nav
        animate={{
          width: isCompact ? "min(920px, 100%)" : "min(1240px, 100%)",
          y: isCompact ? 0 : 2,
        }}
        className={cn(
          "mx-auto flex h-16 items-center justify-between gap-3 px-3 transition-colors duration-300 sm:px-4",
          isCompact
            ? "rounded-full border border-slate-950/10 bg-white/66 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-white/15 dark:bg-slate-950/55 dark:shadow-black/35"
            : "rounded-full border border-transparent bg-transparent",
        )}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <a
          aria-label="Ecogrid home"
          className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-slate-950 dark:text-white"
          href="#home"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-emerald-400/35 bg-emerald-300/16 text-emerald-600 shadow-[0_0_28px_rgba(52,211,153,0.24)] dark:text-emerald-200">
            <Box className="size-5" strokeWidth={1.6} />
          </span>
          <span className="hidden text-sm font-medium uppercase tracking-[0.32em] sm:block">
            Ecogrid
          </span>
        </a>

        <AnimatePresence mode="wait">
          {isCompact ? (
            <motion.div
              className="hidden items-center gap-1 lg:flex"
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              transition={{ duration: 0.28 }}
            >
              {navItems.map((item) => (
                <Button
                  asChild
                  className={cn(
                    "rounded-lg text-slate-600 dark:text-slate-300/80",
                    item.label === "Home" &&
                      "bg-secondary/80 text-secondary-foreground shadow-sm dark:bg-white/[0.08] dark:text-white",
                  )}
                  key={item.label}
                  size="sm"
                  variant={item.label === "Home" ? "secondary" : "ghost"}
                >
                  <a href={item.href}>{item.label}</a>
                </Button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="hidden items-center gap-2 lg:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              {landingActions.map((item) => (
                <Button
                  asChild
                  className="rounded-lg text-slate-600 hover:bg-white/55 hover:text-slate-950 dark:text-slate-200/80 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  key={item.title}
                  size="sm"
                  variant="ghost"
                >
                  <a href={item.href}>{item.title}</a>
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            className="hidden rounded-xl bg-slate-950/80 px-3.5 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-950/90 dark:bg-white/[0.12] dark:text-white dark:shadow-black/20 dark:hover:bg-white/[0.18] sm:inline-flex"
            size="lg"
            variant="secondary"
          >
            <a href="#cta">
              Launch
              <ArrowRight className="size-4 text-emerald-300 transition group-hover/button:text-emerald-200" />
            </a>
          </Button>
        </div>
      </motion.nav>
    </header>
  );
}
