import { Button } from "../ui/button";

export function TopNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8 lg:px-10">
        <a className="flex items-center gap-4" href="/" aria-label="Ecogrid home">
          <span className="grid size-10 place-items-center rounded-lg border border-emerald-200/50 bg-emerald-300/10 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.24)]">
            EG
          </span>
          <span className="text-lg font-semibold uppercase tracking-[0.34em] text-white">
            Ecogrid
          </span>
        </a>
        <Button variant="ghost">About Ecogrid</Button>
      </nav>
    </header>
  );
}
