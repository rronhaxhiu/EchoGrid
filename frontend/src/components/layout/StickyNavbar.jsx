"use client";

import { useEffect, useState } from "react";
import { navItems } from "@/data/landingContent";

export function StickyNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/8 bg-white/80 shadow-md shadow-black/5 backdrop-blur-xl dark:bg-[#02050c]/82"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-10">
        <a
          aria-label="Ecogrid home"
          className="flex items-center gap-3"
          href="/"
        >
          <span className="grid size-8 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-xs font-bold text-cyan-600 dark:text-cyan-300">
            EG
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 dark:text-white">
            Ecogrid
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <li key={item.label}>
              <a
                className="rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                href={item.href}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
          href="/world"
        >
          Launch
        </a>
      </nav>
    </header>
  );
}
