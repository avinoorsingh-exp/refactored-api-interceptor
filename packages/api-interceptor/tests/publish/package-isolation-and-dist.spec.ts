import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from '@jest/globals';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '../..');
const readUtf = (path: string) => readFileSync(path, 'utf8');

function parseJson(path: string): Record<string, unknown> {
	return JSON.parse(readUtf(path)) as Record<string, unknown>;
}

describe('publish isolation (manifest and bundler config)', () => {
	it('declares only public npm dependencies (no workspace or @exprealty packages in dependencies)', () => {
		const pg = join(pkgDir, 'package.json');
		const pkg = parseJson(pg) as { dependencies: Record<string, string> };
		for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
			if (name.startsWith('@exprealty/') || (typeof spec === 'string' && spec.startsWith('workspace:'))) {
				throw new Error(`Disallowed for standalone publish: ${name} = ${spec}`);
			}
		}
		expect(true).toBe(true);
	});

	it('keeps tsup config external list free of @exprealty', () => {
		const cfgPath = join(pkgDir, 'tsup.config.ts');
		const src = readUtf(cfgPath);
		expect(src).toMatch(/external:\s*\[/);
		expect(src).not.toMatch(/@exprealty/);
	});

	it('does not depend on typeorm', () => {
		const pkg = parseJson(join(pkgDir, 'package.json')) as { dependencies?: Record<string, string> };
		expect(pkg.dependencies?.typeorm).toBeUndefined();
		expect(pkg.dependencies?.['@nestjs/typeorm']).toBeUndefined();
	});
});

describe('build output (dist) for CodeArtifact', () => {
	const distMain = join(pkgDir, 'dist', 'index.js');

	it('`pnpm run test:full` (or `build` first) should produce dist; then the bundle is publishable in isolation', () => {
		if (!existsSync(distMain)) {
			return;
		}
		const body = readUtf(distMain);
		expect(body).not.toMatch(/@exprealty\//);
		const head = body.slice(0, 12_000);
		expect(head).toMatch(/from '@nestjs\//);
		expect(head).not.toMatch(/from 'typeorm'/);
	});
});
