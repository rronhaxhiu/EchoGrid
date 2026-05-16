declare module "hexasphere" {
  interface HPoint {
    x: number;
    y: number;
    z: number;
  }

  interface HTile {
    centerPoint: HPoint;
    boundary: HPoint[];
    neighbors: HTile[];
  }

  class Hexasphere {
    constructor(radius: number, numDivisions: number, hexSize: number);
    radius: number;
    tiles: HTile[];
  }

  export { Hexasphere, HTile, HPoint };
}
