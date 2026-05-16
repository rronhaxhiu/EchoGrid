let loading: Promise<void> | null = null;

function appendScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function loadGlobeScripts(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!loading) {
    loading = appendScript("/globe/three.min.js").then(() =>
      appendScript("/globe/globe.js"),
    );
  }

  return loading;
}
