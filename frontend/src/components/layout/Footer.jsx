import { Box } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { footerLinks, socialLinks } from "@/data/landingContent";

export function Footer() {
  return (
    <footer
      id="team"
      className="relative overflow-hidden bg-slate-100 px-5 py-14 text-slate-700 dark:bg-[#02050c] dark:text-slate-300"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div>
            <a className="inline-flex items-center gap-3 text-slate-950 dark:text-white" href="#home">
              <span className="grid size-11 place-items-center rounded-full border border-emerald-400/35 bg-emerald-300/16 text-emerald-600 dark:text-emerald-200">
                <Box className="size-5" strokeWidth={1.6} />
              </span>
              <span className="text-base font-medium uppercase tracking-[0.32em]">
                Ecogrid
              </span>
            </a>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-400">
              Planetary simulation, regional intelligence, and environmental
              forecasting presented through a cinematic globe interface.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-950 dark:text-white">Navigation</h3>
            <div className="mt-4 grid gap-3">
              {footerLinks.map((link) => (
                <a className="text-sm transition hover:text-cyan-600 dark:hover:text-cyan-200" href={link.href} key={link.label}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-950 dark:text-white">Social</h3>
            <div className="mt-4 flex gap-2">
              {socialLinks.map((link) => (
                <a
                  aria-label={link.label}
                  className="grid size-10 place-items-center rounded-full border border-slate-950/10 bg-white/55 text-xs font-medium transition hover:border-cyan-400/30 hover:text-cyan-600 dark:border-white/10 dark:bg-white/[0.06] dark:hover:text-cyan-200"
                  href={link.href}
                  key={link.label}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-slate-950/10 dark:bg-white/10" />
        <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-500">
          <span>Copyright 2026 Ecogrid. All rights reserved.</span>
          <span>Simulation interface prototype.</span>
        </div>
      </div>
    </footer>
  );
}
