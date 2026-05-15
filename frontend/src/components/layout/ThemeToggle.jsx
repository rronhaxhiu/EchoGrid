import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border-slate-950/10 bg-white/55 text-slate-900 shadow-lg backdrop-blur-xl hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.14]"
      onClick={toggleTheme}
      size="icon-lg"
      type="button"
      variant="outline"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
