import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pkgDir = join(__dirname, '../..');
const readUtf = (path: string) => readFileSync(path, 'utf8');

function parseJson(path: string): Record<string, unknown> {
	return JSON.parse(readUtf(path)) as Record<string, unknown>;
}

describe('@exprealty/api-monitoring publish isolation (manifest and bundler config)', () => {
	it('declares only public npm dependencies (no workspace or @exprealty packages in dependencies)', () => {
		const pg = join(pkgDir, 'package.json');
		const pkg = parseJson(pg) as { dependencies: Record<string, string> };
		for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
			if (name.startsWith('@exprealty/') || (typeof spec === 'string' && spec.startsWith('workspace:'))) {
				throw new Error(`Disallowed for standalone publish: ${name} = ${String(spec)}`);
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
});

describe('build output (dist) for CodeArtifact', () => {
	const distMain = join(pkgDir, 'dist', 'index.js');

	it('`pnpm run test:full` (or `build` first) should produce dist; then the bundle is publishable in isolation', () => {
		if (!existsSync(distMain)) {
			// `pnpm test` only: skip file assertions. CI should use `pnpm run test:full` after a clean tree.
			return;
		}
		const body = readUtf(distMain);
		expect(body).not.toMatch(/@exprealty\//);
		const head = body.slice(0, 12_000);
		expect(head).toMatch(/from 'typeorm'/);
		expect(head).toMatch(/from '@nestjs\//);
	});
});
