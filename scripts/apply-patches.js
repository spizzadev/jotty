const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

const _PATCH_DIRS = [
  path.join(projectRoot, "patches"),
  path.join(projectRoot, "user_patches"),
];

const _loadPatches = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => ({ file: f, fullPath: path.join(dir, f), source: path.basename(dir) }));
};

const ctx = { projectRoot };

let _failed = 0;
for (const dir of _PATCH_DIRS) {
  for (const entry of _loadPatches(dir)) {
    try {
      const patch = require(entry.fullPath);
      if (typeof patch.apply !== "function") {
        console.warn(`[patch:${entry.source}] ${entry.file}: skipped (no apply())`);
        continue;
      }
      const result = patch.apply(ctx);
      console.log(`[patch:${entry.source}] ${patch.name || entry.file}: ${result || "ok"}`);
    } catch (err) {
      _failed++;
      console.error(`[patch:${entry.source}] ${entry.file} failed: ${err.message}`);
    }
  }
}

if (_failed > 0) process.exitCode = 1;
