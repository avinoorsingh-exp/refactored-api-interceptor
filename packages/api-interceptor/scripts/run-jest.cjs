'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
const jestEntry = require.resolve('jest/bin/jest', { paths: [pkgRoot] });
const configPath = path.join(pkgRoot, 'jest.config.cjs');

const extra = process.argv.slice(2);
const result = spawnSync(
	process.execPath,
	['--experimental-vm-modules', jestEntry, '--config', configPath, ...extra],
	{ stdio: 'inherit', cwd: pkgRoot },
);

process.exit(result.status === null ? 1 : result.status);
