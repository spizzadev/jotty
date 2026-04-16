'use strict';

/**
 * Patches @swc/core/binding.js on FreeBSD so that modules importing @swc/core
 * do not crash at require time when no native binary is available.
 *
 * Context: next-intl (and @serwist/turbopack) depend on @swc/core, whose
 * binding.js throws immediately on unsupported platforms. On FreeBSD there is
 * no native binary and no published WASM fallback package, so the import fails
 * before the build even starts. The patch makes binding.js return a lazy stub
 * on FreeBSD instead — methods only throw when actually called, which is never
 * the case in this project (next-intl's experimental.extract is not enabled).
 */

const fs = require('fs');
const path = require('path');

if (process.platform !== 'freebsd') {
  process.exit(0);
}

const NEEDLE = `if (!nativeBinding) {
  if (loadErrors.length > 0) {
    // TODO Link to documentation with potential fixes
    //  - The package owner could build/publish bindings for this arch
    //  - The user may need to bundle the correct files
    //  - The user may need to re-install node_modules to get new packages
    throw new Error('Failed to load native binding', { cause: loadErrors })
  }
  throw new Error(\`Failed to load native binding\`)
}`;

const REPLACEMENT = `if (!nativeBinding) {
  if (process.platform === 'freebsd') {
    // FreeBSD: no native or WASM binary is available from @swc/core.
    // Return a stub so modules that import @swc/core without using it can load.
    // Any actual call to @swc/core methods will throw at call time.
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
    // TODO Link to documentation with potential fixes
    //  - The package owner could build/publish bindings for this arch
    //  - The user may need to bundle the correct files
    //  - The user may need to re-install node_modules to get new packages
    throw new Error('Failed to load native binding', { cause: loadErrors })
  } else {
    throw new Error(\`Failed to load native binding\`)
  }
}`;

// Find all @swc/core/binding.js files under node_modules (handles hoisted and
// nested installs, e.g. node_modules/@swc/core and
// node_modules/next-intl/node_modules/@swc/core).
function findBindingFiles(dir, results = []) {
  const swcCore = path.join(dir, '@swc', 'core', 'binding.js');
  if (fs.existsSync(swcCore)) {
    results.push(swcCore);
  }
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '@swc') continue; // already checked above
      const nested = path.join(dir, entry.name, 'node_modules');
      if (fs.existsSync(nested)) {
        findBindingFiles(nested, results);
      }
    }
  } catch (_) {}
  return results;
}

const nodeModules = path.join(__dirname, '..', 'node_modules');
const bindingFiles = findBindingFiles(nodeModules);

if (bindingFiles.length === 0) {
  console.warn('postinstall: no @swc/core/binding.js found — skipping FreeBSD patch.');
  process.exit(0);
}

let patched = 0;
for (const file of bindingFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('x86_64-unknown-freebsd')) {
    continue; // already patched
  }
  if (!src.includes(NEEDLE)) {
    console.warn(`postinstall: unexpected binding.js format at ${file} — skipping.`);
    continue;
  }
  fs.writeFileSync(file, src.replace(NEEDLE, REPLACEMENT));
  patched++;
  console.log(`postinstall: patched ${file}`);
}

if (patched === 0) {
  console.log('postinstall: @swc/core/binding.js already patched, nothing to do.');
}
