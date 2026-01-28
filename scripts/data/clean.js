import fs from "node:fs/promises";
import path from "node:path";
import { RAW_DIR, OUTPUT_DIR } from "./config.js";
import { ROOT_DIR } from "./utils.js";

const removeDir = async (dir) => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore if the directory does not exist.
  }
};

const run = async () => {
  await removeDir(path.join(ROOT_DIR, RAW_DIR));
  await removeDir(path.join(ROOT_DIR, OUTPUT_DIR));
  console.log("Removed raw and output heatmap data.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
