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

/**
 * Converts flat "parent > child" tag folders into nested Postman subfolders.
 * E.g., a top-level folder named "agents > notes" becomes a "notes" subfolder
 * inside the "agents" folder. If the parent folder doesn't exist, it is created.
 */
function nestHierarchicalFolders(collection) {
	if (!collection.item || !Array.isArray(collection.item)) return;

	const topLevel = collection.item;
	const toRemove = [];

	for (let i = 0; i < topLevel.length; i++) {
		const folder = topLevel[i];
		if (!folder.name || !folder.name.includes(' > ')) continue;

		const [parentName, childName] = folder.name.split(' > ').map((s) => s.trim());

		// Find or create parent folder
		let parent = topLevel.find(
			(f) => f.name === parentName && f.item && !f.name.includes(' > '),
		);
		if (!parent) {
			parent = { name: parentName, item: [] };
			topLevel.push(parent);
		}
		if (!parent.item) parent.item = [];

		// Move as subfolder with the child name
		parent.item.push({ ...folder, name: childName });
		toRemove.push(i);
	}

	// Remove moved folders (reverse order to preserve indices)
	for (const idx of toRemove.reverse()) {
		topLevel.splice(idx, 1);
	}
}

/**
 * Configuration for auto-capturing IDs from list endpoints and wiring them
 * into child route path parameters as Postman collection variables.
 *
 * Each entry defines:
 *   - parentFolder: the top-level folder name (matches @ApiTags)
 *   - listMethod: HTTP method of the list endpoint (GET)
 *   - listNamePattern: regex to match the list request name
 *   - variableName: Postman variable name to set (e.g., "agentId")
 *   - responsePath: JS expression to extract the ID from the response JSON
 *   - pathSegment: the URL path variable name to replace in child routes (e.g., ":id")
 */
const ID_CAPTURE_CONFIG = [
	{
		parentFolder: 'agents',
		listMethod: 'GET',
		listNamePattern: /list agent/i,
		variableName: 'agentId',
		responsePath: 'data[0].id',
		pathSegment: ':id',
	},
	{
		parentFolder: 'countries',
		listMethod: 'GET',
		listNamePattern: /list countries/i,
		variableName: 'countryId',
		responsePath: 'data[0].id',
		pathSegment: ':countryId',
	},
];

/**
 * Injects Postman "Tests" scripts on list endpoints to capture the first
 * item's ID into a collection variable, and replaces matching path params
 * in child routes with the variable reference.
 */
function injectIdCaptureScripts(collection) {
	if (!collection.item || !Array.isArray(collection.item)) return;

	// Ensure collection variables array exists
	if (!collection.variable) collection.variable = [];

	for (const config of ID_CAPTURE_CONFIG) {
		const folder = collection.item.find((f) => f.name === config.parentFolder);
		if (!folder || !folder.item) continue;

		// Register the collection variable with a placeholder
		if (!collection.variable.find((v) => v.key === config.variableName)) {
			collection.variable.push({
				key: config.variableName,
				value: '',
				type: 'string',
				description: `Auto-captured from GET list ${config.parentFolder}`,
			});
		}

		// Find the list endpoint in the folder's direct items
		const listRequest = folder.item.find(
			(item) =>
				!item.item && // not a subfolder
				item.request?.method === config.listMethod &&
				config.listNamePattern.test(item.name),
		);

		if (listRequest) {
			// Inject a "Tests" (post-response) script to capture ID
			const script = [
				`// Auto-generated: capture ${config.variableName} from list response`,
				`const jsonData = pm.response.json();`,
				`if (jsonData.data && jsonData.data.length > 0) {`,
				`    const id = jsonData.${config.responsePath};`,
				`    pm.collectionVariables.set("${config.variableName}", id);`,
				`    console.log("Captured ${config.variableName}:", id);`,
				`} else {`,
				`    console.warn("No ${config.parentFolder} found to capture ID from");`,
				`}`,
			];

			if (!listRequest.event) listRequest.event = [];
			// Remove any existing test script to avoid duplicates
			listRequest.event = listRequest.event.filter((e) => e.listen !== 'test');
			listRequest.event.push({
				listen: 'test',
				script: { type: 'text/javascript', exec: script },
			});
		}

		// Replace path params in child routes (subfolders and direct items)
		replacePathParam(folder.item, config.pathSegment, `{{${config.variableName}}}`);
	}
}

/**
 * Recursively replaces a path segment variable (e.g., ":id") with a Postman
 * variable reference (e.g., "{{agentId}}") in all request URL paths.
 */
function replacePathParam(items, segment, replacement) {
	for (const item of items) {
		if (item.item) {
			// Recurse into subfolders
			replacePathParam(item.item, segment, replacement);
		}
		if (item.request?.url?.path) {
			item.request.url.path = item.request.url.path.map((p) =>
				p === segment ? replacement : p,
			);
		}
		// Also update the raw URL string if present
		if (item.request?.url?.raw) {
			item.request.url.raw = item.request.url.raw.replace(
				new RegExp(segment.replace(':', '\\:'), 'g'),
				replacement,
			);
		}
	}
}

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

			// Post-process: nest "parent > child" tag folders into subfolders
			nestHierarchicalFolders(processedCollection);

			// Post-process: inject ID capture scripts and wire collection variables
			injectIdCaptureScripts(processedCollection);

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
