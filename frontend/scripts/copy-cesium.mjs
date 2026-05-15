/**
 * Copy Cesium static assets (Workers, Assets, Widgets) into public/ for runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = path.join(root, "public", "cesium");

if (!fs.existsSync(src)) {
  console.warn("copy-cesium: Cesium build not found at", src);
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("copy-cesium: copied to", dest);
