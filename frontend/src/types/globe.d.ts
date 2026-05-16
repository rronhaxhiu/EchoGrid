export interface GlobeInstance {
  addData: (
    data: number[],
    opts: { name?: string; animated?: boolean; format?: "magnitude" | "legend" },
  ) => void;
  createPoints: () => void;
  animate: () => void;
  time: number;
  renderer: unknown;
  scene: unknown;
}

declare global {
  interface Window {
    THREE: unknown;
    DAT: {
      Globe: new (
        container: HTMLElement,
        opts?: { imgDir?: string; colorFn?: (x: number) => unknown },
      ) => GlobeInstance;
    };
  }
}

export {};
