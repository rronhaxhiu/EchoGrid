import { footerLinks, socialLinks } from "@/data/landingContent";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/60 bg-white py-12 dark:border-white/8 dark:bg-[#02050c]">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <a className="flex items-center gap-3" href="/">
            <span className="grid size-8 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-xs font-bold text-cyan-600 dark:text-cyan-300">
              EG
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 dark:text-white">
              Ecogrid
            </span>
          </a>

          <ul className="flex items-center gap-4">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <a
                  className="text-xs font-medium uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <ul className="flex items-center gap-3">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <a
                  aria-label={link.label}
                  className="grid size-8 place-items-center rounded-lg border border-slate-200 text-xs font-bold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/30 dark:hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          &copy; {new Date().getFullYear()} Ecogrid. Planetary simulation
          interface.
        </p>
      </div>
    </footer>
  );
}
