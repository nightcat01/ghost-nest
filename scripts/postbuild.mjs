import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const copyTargets = [
  ["ghost-nest.extensions.json", "dist/ghost-nest.extensions.json"],
  ["src/devtools/layer-part-workflow.api.json", "dist/devtools/layer-part-workflow.api.json"],
  ["src/devtools/layer-part-workflow.sdxl-inpaint.api.json", "dist/devtools/layer-part-workflow.sdxl-inpaint.api.json"],
  ["src/devtools/layer-part-workflow.sdxl-general.api.json", "dist/devtools/layer-part-workflow.sdxl-general.api.json"],
  ["src/devtools/layer-part-workflow.sd15-inpaint.api.json", "dist/devtools/layer-part-workflow.sd15-inpaint.api.json"],
];

await mkdir(path.join(rootDir, "dist", "devtools"), { recursive: true });

await Promise.all(copyTargets.map(async ([source, destination]) => {
  await copyFile(path.join(rootDir, source), path.join(rootDir, destination));
}));
