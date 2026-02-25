#!/usr/bin/env node
/**
 * generate-postman.mjs
 *
 * Converts an OpenAPI JSON spec into:
 *   - A Postman collection (v2.1)
 *   - A Postman environment template
 *
 * Usage:
 *   node scripts/generate-postman.mjs [openapi-path]
 *
 * Defaults:
 *   openapi-path: artifacts/openapi/agent-service.openapi.json
 *
 * Outputs:
 *   artifacts/postman/agent-service.postman_collection.json
 *   artifacts/postman/env.template.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const openapiPath =
	process.argv[2] || join(repoRoot, 'artifacts/openapi/agent-service.openapi.json');
const outDir = join(repoRoot, 'artifacts/postman');

// ── Read OpenAPI spec ────────────────────────────────────────────
let spec;
try {
	spec = JSON.parse(readFileSync(openapiPath, 'utf8'));
} catch (err) {
	console.error(`Failed to read OpenAPI spec: ${openapiPath}`);
	console.error(err.message);
	console.error('');
	console.error('Run "pnpm openapi:export" first to fetch the spec.');
	process.exit(1);
}

// ── Convert to Postman collection ────────────────────────────────
let Converter;
try {
	Converter = (await import('openapi-to-postmanv2')).default || (await import('openapi-to-postmanv2'));
} catch (err) {
	console.error('Missing dependency: openapi-to-postmanv2');
	console.error('Run: pnpm add -Dw openapi-to-postmanv2');
	process.exit(1);
}

const conversionOptions = {
	schemaFaker: true,
	requestParametersResolution: 'Example',
	exampleParametersResolution: 'Example',
	folderStrategy: 'Tags',
};

await new Promise((resolve, reject) => {
	Converter.convert(
		{ type: 'json', data: spec },
		conversionOptions,
		(err, result) => {
			if (err) {
				console.error('Conversion failed:', err);
				reject(err);
				return;
			}
			if (!result.result) {
				console.error('Conversion failed:', result.reason);
				reject(new Error(result.reason));
				return;
			}

			const collection = result.output[0].data;

			// Post-process: replace hardcoded host with {{baseUrl}} variable
			const collectionStr = JSON.stringify(collection, null, 2).replace(
				/http:\/\/localhost:3000/g,
				'{{baseUrl}}',
			);
			const processedCollection = JSON.parse(collectionStr);

			// Add auth configuration using Postman variables
			processedCollection.auth = {
				type: 'bearer',
				bearer: [{ key: 'token', value: '{{authToken}}', type: 'string' }],
			};

			mkdirSync(outDir, { recursive: true });

			const collectionPath = join(
				outDir,
				'agent-service.postman_collection.json',
			);
			writeFileSync(
				collectionPath,
				JSON.stringify(processedCollection, null, 2),
			);
			console.log(`Written: ${collectionPath}`);
			resolve();
		},
	);
});

// ── Generate environment template ────────────────────────────────
const envTemplate = {
	id: 'agent-service-env-template',
	name: 'Agent Service (Template)',
	_postman_variable_scope: 'environment',
	_postman_exported_using: 'scripts/generate-postman.mjs',
	values: [
		{
			key: 'baseUrl',
			value: 'http://localhost:3000',
			type: 'default',
			enabled: true,
			description:
				'Base URL of agent-service. Change to https://dev.example.com for dev/stage.',
		},
		{
			key: 'authMode',
			value: 'none',
			type: 'default',
			enabled: true,
			description:
				'Auth strategy: none | bearer | apikey. Controls which auth headers are sent.',
		},
		{
			key: 'authToken',
			value: '',
			type: 'secret',
			enabled: true,
			description:
				'Bearer token. Set when authMode=bearer. Used in collection-level auth.',
		},
		{
			key: 'apiKey',
			value: '',
			type: 'secret',
			enabled: true,
			description:
				'API key. Set when authMode=apikey. Add a pre-request script to set x-api-key header.',
		},
		{
			key: 's2sKey',
			value: '',
			type: 'secret',
			enabled: true,
			description:
				'Service-to-service internal key. Set for S2S auth testing.',
		},
	],
};

const envPath = join(outDir, 'env.template.json');
writeFileSync(envPath, JSON.stringify(envTemplate, null, 2));
console.log(`Written: ${envPath}`);

console.log('');
console.log('Import into Postman:');
console.log(
	`  Collection: ${join(outDir, 'agent-service.postman_collection.json')}`,
);
console.log(`  Environment: ${envPath}`);
