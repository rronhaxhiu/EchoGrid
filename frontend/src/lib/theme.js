const storageKey = "ecogrid-theme";

export function getInitialTheme() {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.localStorage.getItem(storageKey) || "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function persistTheme(theme) {
  window.localStorage.setItem(storageKey, theme);
}

export function initializeTheme() {
  if (typeof window === "undefined") {
    return;
  }

  applyTheme(getInitialTheme());
}
