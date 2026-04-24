import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  target: 'node20',
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/swagger',
    '@nestjs/typeorm',
    'class-transformer',
    'class-validator',
    'rxjs',
    'typeorm',
    'express'
  ]
})
