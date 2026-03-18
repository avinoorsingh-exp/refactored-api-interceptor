// @ts-check
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
const __dirname = dirname(fileURLToPath(import.meta.url));
export default [
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    prettier,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: ['./tsconfig.eslint.json'], // <-- point to the new project
            },
        },
    },
    {
        files: ['packages/*/src/**/*.ts', 'packages/*/tests/**/*.ts', 'services/*/src/**/*.ts', 'services/*/tests/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                { allowNumber: true, allowBoolean: true },
            ],
            '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
        },
    },
    {
        files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts', 'test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^(jest|describe|it|expect|beforeEach|afterEach|beforeAll|afterAll)$' }],
            'no-console': 'off',
        },
    },
    {
        ignores: [
            '.nx/**',
            '**/.nx/**',
            'node_modules/**',
            '**/assets/**/*',
            '**/dist/**',
            '**/coverage/**',
            // Ignore generated files in src (like logger package)
            'packages/*/src/**/*.js',
            'packages/*/src/**/*.d.ts',
            '!packages/*/src/**/index.ts',
        ],
    },
    {
        files: ['**/tailwind.config.js'],
        rules: {},
    },
    {
        files: ['**/postcss.config.cjs'],
        languageOptions: {
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                process: 'readonly',
                console: 'readonly',
            },
        },
    },
];
