import { useEffect, useState } from "react";

import { LandingPage } from "@/pages/LandingPage";
import { WorldPage } from "@/pages/WorldPage";

const routePaths = new Set(["/", "/world"]);

function normalizePath(pathname) {
  return pathname === "/world" ? "/world" : "/";
}

export function Router() {
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  );

  useEffect(() => {
    const syncPath = () => setPathname(normalizePath(window.location.pathname));

    const handleClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest("a[href]");
      if (!anchor || anchor.target) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !routePaths.has(url.pathname)) {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setPathname(normalizePath(url.pathname));
      window.scrollTo(0, 0);
    };

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", syncPath);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  return pathname === "/world" ? <WorldPage /> : <LandingPage />;
}
