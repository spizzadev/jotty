const fs = require("fs");
const path = require("path");

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const collectLeafPaths = (node, prefix = "") => {
  const paths = [];
  if (!isPlainObject(node)) {
    if (prefix) paths.push(prefix);
    return paths;
  }
  for (const key of Object.keys(node).sort()) {
    const next = prefix ? `${prefix}.${key}` : key;
    paths.push(...collectLeafPaths(node[key], next));
  }
  return paths;
};

const parseArgs = (argv) => {
  const defaultBase = "en";
  const translationsDir = path.join("app", "_translations");
  let onlyLocale = null;
  let showExtra = false;
  let out = defaultBase;
  let dir = translationsDir;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--base" && argv[i + 1]) {
      out = argv[i + 1].replace(/\.json$/i, "");
      i += 1;
    } else if (a === "--dir" && argv[i + 1]) {
      dir = argv[i + 1];
      i += 1;
    } else if (a === "--locale" && argv[i + 1]) {
      onlyLocale = argv[i + 1].replace(/\.json$/i, "");
      i += 1;
    } else if (a === "--extra") {
      showExtra = true;
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        [
          "Usage: node scripts/compare-translations.js [options]",
          "",
          "Compares locale JSON files to a baseline and lists missing translation keys.",
          "",
          "Options:",
          "  --base <code>   Baseline locale file name without .json (default: en)",
          "  --dir <path>    Translations directory (default: app/_translations)",
          "  --locale <code> Only compare this locale",
          "  --extra         Also list keys present only in non-baseline files",
          "",
        ].join("\n")
      );
      process.exit(0);
    }
  }
  return { base: out, dir, onlyLocale, showExtra };
};

const loadLocaleJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const main = () => {
  const cwd = process.cwd();
  const { base, dir, onlyLocale, showExtra } = parseArgs(process.argv);
  const absDir = path.isAbsolute(dir) ? dir : path.join(cwd, dir);

  if (!fs.existsSync(absDir)) {
    process.stderr.write(`Translations directory not found: ${absDir}\n`);
    process.exit(1);
  }

  const baseFile = path.join(absDir, `${base}.json`);
  if (!fs.existsSync(baseFile)) {
    process.stderr.write(`Baseline file not found: ${baseFile}\n`);
    process.exit(1);
  }

  const baseJson = loadLocaleJson(baseFile);
  const basePaths = collectLeafPaths(baseJson);
  const baseSet = new Set(basePaths);

  const files = fs
    .readdirSync(absDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/i, ""))
    .filter((code) => code !== base);

  const targets = onlyLocale
    ? files.filter((c) => c === onlyLocale)
    : files;

  if (onlyLocale && targets.length === 0) {
    process.stderr.write(
      `Locale "${onlyLocale}" not found or is the baseline.\n`
    );
    process.exit(1);
  }

  let hadMissing = false;

  for (const locale of targets.sort()) {
    const filePath = path.join(absDir, `${locale}.json`);
    const json = loadLocaleJson(filePath);
    const localePaths = collectLeafPaths(json);
    const localeSet = new Set(localePaths);

    const missing = basePaths.filter((p) => !localeSet.has(p));
    const extra = showExtra
      ? localePaths.filter((p) => !baseSet.has(p))
      : [];

    const hasIssue =
      missing.length > 0 || (showExtra && extra.length > 0);
    if (!hasIssue) {
      continue;
    }

    process.stdout.write(`\n=== ${locale}.json (vs ${base}.json) ===\n`);

    if (missing.length > 0) {
      hadMissing = true;
      process.stdout.write(`Missing ${missing.length} key(s):\n`);
      for (const key of missing) {
        process.stdout.write(`  - ${key}\n`);
      }
    }

    if (showExtra && extra.length > 0) {
      process.stdout.write(
        `\nExtra ${extra.length} key(s) (not in ${base}.json):\n`
      );
      for (const key of extra) {
        process.stdout.write(`  + ${key}\n`);
      }
    }
  }

  if (!hadMissing) {
    if (targets.length === 0) {
      process.stdout.write(
        `No locales to compare (only baseline ${base}.json found).\n`
      );
    } else {
      process.stdout.write(
        `All checked locales match ${base}.json leaf keys.\n`
      );
    }
  }

  process.exit(hadMissing ? 1 : 0);
};

main();
