"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Activity, Settings, Layers, Bug } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/predictions", label: "Predictions", icon: Bug },
  { href: "/world", label: "World", icon: Globe },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16">
      {/* Glass background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/50" />

      <div className="relative flex items-center justify-between h-full px-6 max-w-screen-xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-md shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="text-violet-600 dark:text-violet-400">Echo</span>
            <span className="text-foreground">Grid</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
