import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts', 'src/nest-logger.ts', 'src/metrics.ts', 'src/log-tier.ts'],
	format: ['esm'],
	clean: true,
	target: 'esnext',
	dts: true,
})
