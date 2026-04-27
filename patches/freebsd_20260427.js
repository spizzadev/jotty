/**
 * FreeBSD Compatibility Patch (2026-04-27)
 *
 * FreeBSD ships without prebuilt native binaries for @swc/core and Turbopack,
 * so a stock `next dev`/`next build` crashes at require time. This patch:
 *
 *   1. Stubs node_modules/@swc/core/binding.js so modules that import @swc/core
 *      (next-intl, @serwist/turbopack) do not throw at load. Stub methods only
 *      throw when actually called — which never happens in this project.
 *   2. Forces the Next.js bundler selector to webpack by injecting a guard at
 *      the top of node_modules/next/dist/lib/bundler.js parseBundlerArgs(),
 *      so Turbopack (which has no FreeBSD binary) is never chosen.
 *
 * Gated on the JOTTY_FREEBSD env var: this patch is a no-op everywhere else.
 * Idempotent: re-runs detect prior application and skip.
 */

const fs = require("fs");
const path = require("path");

const _SWC_NEEDLE = `if (!nativeBinding) {
  if (loadErrors.length > 0) {
    // TODO Link to documentation with potential fixes
    //  - The package owner could build/publish bindings for this arch
    //  - The user may need to bundle the correct files
    //  - The user may need to re-install node_modules to get new packages
    throw new Error('Failed to load native binding', { cause: loadErrors })
  }
  throw new Error(\`Failed to load native binding\`)
}`;

const _SWC_REPLACEMENT = `if (!nativeBinding) {
  if (process.env.JOTTY_FREEBSD) {
    const noBinding = () => {
      throw new Error(
        '@swc/core: no native or WASM binding available for FreeBSD. ' +
        'Build @swc/core from source or provide a WASM fallback.'
      )
    }
    nativeBinding = {
      Compiler: class { constructor() { noBinding() } },
      JsCompiler: class { constructor() { noBinding() } },
      analyze: noBinding, bundle: noBinding,
      getTargetTriple: () => 'x86_64-unknown-freebsd',
      initCustomTraceSubscriber: noBinding, minify: noBinding,
      minifySync: noBinding, newMangleNameCache: noBinding,
      parse: noBinding, parseFile: noBinding,
      parseFileSync: noBinding, parseSync: noBinding,
      print: noBinding, printSync: noBinding,
      transform: noBinding, transformFile: noBinding,
      transformFileSync: noBinding, transformSync: noBinding,
    }
  } else if (loadErrors.length > 0) {
    throw new Error('Failed to load native binding', { cause: loadErrors })
  } else {
    throw new Error(\`Failed to load native binding\`)
  }
}`;

const _BUNDLER_NEEDLE = `function parseBundlerArgs(options) {`;
const _BUNDLER_REPLACEMENT = `function parseBundlerArgs(options) {
    if (process.env.JOTTY_FREEBSD) { options.webpack = true; options.turbopack = false; options.turbo = false; }`;
const _BUNDLER_MARKER = `JOTTY_FREEBSD`;

const _findSwcBindings = (dir, results = []) => {
  const swcCore = path.join(dir, "@swc", "core", "binding.js");
  if (fs.existsSync(swcCore)) results.push(swcCore);
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "@swc") continue;
      const nested = path.join(dir, entry.name, "node_modules");
      if (fs.existsSync(nested)) _findSwcBindings(nested, results);
    }
  } catch (_) { }
  return results;
};

const _patchSwc = (file) => {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("x86_64-unknown-freebsd")) return "noop";
  if (!src.includes(_SWC_NEEDLE)) return "skipped";
  fs.writeFileSync(file, src.replace(_SWC_NEEDLE, _SWC_REPLACEMENT));
  return "patched";
};

const _patchBundler = (file) => {
  if (!fs.existsSync(file)) return "missing";
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(_BUNDLER_MARKER)) return "noop";
  if (!src.includes(_BUNDLER_NEEDLE)) return "skipped";
  fs.writeFileSync(file, src.replace(_BUNDLER_NEEDLE, _BUNDLER_REPLACEMENT));
  return "patched";
};

module.exports = {
  name: "freebsd_20260427",
  apply: (ctx) => {
    if (!process.env.JOTTY_FREEBSD) return "skipped (JOTTY_FREEBSD not set)";

    const counts = { patched: 0, noop: 0, skipped: 0, missing: 0 };
    const nodeModules = path.join(ctx.projectRoot, "node_modules");

    for (const file of _findSwcBindings(nodeModules)) {
      counts[_patchSwc(file)]++;
    }
    counts[_patchBundler(path.join(nodeModules, "next", "dist", "lib", "bundler.js"))]++;

    return `swc+bundler patched=${counts.patched}, noop=${counts.noop}, skipped=${counts.skipped}, missing=${counts.missing}`;
  },
};
