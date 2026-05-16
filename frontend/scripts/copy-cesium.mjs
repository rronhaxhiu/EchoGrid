import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dirname, "..");
const source = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const destination = path.join(root, "public", "cesium");

if (!fs.existsSync(source)) {
  console.warn("copy-cesium: Cesium build not found at", source);
  process.exit(0);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });

console.log("copy-cesium: copied Cesium assets to public/cesium");
