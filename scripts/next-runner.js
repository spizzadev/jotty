'use strict';

/**
 * Wrapper around `next` that appends --webpack on FreeBSD, where Turbopack is
 * unavailable due to missing native bindings. On all other platforms the
 * arguments are passed through unchanged, preserving Turbopack as the default.
 */

const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
if (process.platform === 'freebsd') {
  args.push('--webpack');
}

const result = spawnSync('next', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
