#!/usr/bin/env node
/**
 * s3.mjs — S3 performance history management.
 *
 * Uses AWS CLI (awscli) for S3 operations — no extra npm dependencies.
 * Credentials: uses default AWS resolution chain (env vars, ~/.aws/credentials, IAM role).
 *
 * Commands:
 *   upload-summary  — Upload current summary to S3
 *   fetch-baseline  — Download baseline from S3
 *   set-baseline    — Upload a summary as the baseline in S3
 *
 * Usage:
 *   node apps/load-test/scripts/s3.mjs upload-summary --env dev --scenario baseline --runid <id> [--source <path>]
 *   node apps/load-test/scripts/s3.mjs fetch-baseline --env dev --scenario baseline [--dest <path>]
 *   node apps/load-test/scripts/s3.mjs set-baseline --env dev --scenario baseline [--source <path>]
 *
 * Env vars:
 *   PERF_S3_BUCKET  (required) — S3 bucket name
 *   PERF_S3_PREFIX  (default: "perf/k6") — key prefix
 *   PERF_S3_REGION  (optional) — AWS region override
 *
 * S3 keys:
 *   <prefix>/<env>/<scenario>/<runid>.json    — run summary
 *   <prefix>/<env>/<scenario>/baseline.json   — baseline
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

const S3_BUCKET = process.env.PERF_S3_BUCKET;
const S3_PREFIX = process.env.PERF_S3_PREFIX || 'perf/k6';
const S3_REGION = process.env.PERF_S3_REGION;

if (!S3_BUCKET) {
	console.error('ERROR: PERF_S3_BUCKET is required.');
	console.error('  export PERF_S3_BUCKET=my-perf-bucket');
	process.exit(1);
}

// ── Parse args ──────────────────────────────────────────────────
function parseArgs() {
	const args = process.argv.slice(2);
	const opts = {
		command: args[0],
		env: 'local',
		scenario: 'baseline',
		source: null,
		dest: null,
		runid: null,
	};

	for (let i = 1; i < args.length; i++) {
		switch (args[i]) {
			case '--env': opts.env = args[++i]; break;
			case '--scenario': opts.scenario = args[++i]; break;
			case '--source': opts.source = args[++i]; break;
			case '--dest': opts.dest = args[++i]; break;
			case '--runid': opts.runid = args[++i]; break;
		}
	}
	return opts;
}

const opts = parseArgs();

// ── Helpers ─────────────────────────────────────────────────────
function s3Key(path) {
	return `s3://${S3_BUCKET}/${S3_PREFIX}/${path}`;
}

function regionFlag() {
	return S3_REGION ? `--region ${S3_REGION}` : '';
}

function awsCmd(cmd) {
	const full = `aws s3 ${cmd} ${regionFlag()}`.trim();
	try {
		execSync(full, { stdio: 'pipe' });
		return true;
	} catch (err) {
		const stderr = err.stderr?.toString() || '';
		if (stderr.includes('NoSuchKey') || stderr.includes('404') || stderr.includes('does not exist')) {
			return false;
		}
		console.error(`AWS CLI error: ${stderr || err.message}`);
		throw err;
	}
}

function findLatestSummary() {
	const k6Dir = join(repoRoot, 'artifacts', 'k6');
	if (!existsSync(k6Dir)) return null;
	const runs = readdirSync(k6Dir)
		.filter((d) => existsSync(join(k6Dir, d, 'k6-summary.json')))
		.sort()
		.reverse();
	return runs.length > 0 ? { path: join(k6Dir, runs[0], 'k6-summary.json'), runid: runs[0] } : null;
}

// ── Commands ────────────────────────────────────────────────────
function uploadSummary() {
	const latest = findLatestSummary();
	const source = opts.source || latest?.path;
	const runid = opts.runid || latest?.runid;

	if (!source || !existsSync(source)) {
		console.error('ERROR: No source summary found.');
		process.exit(1);
	}
	if (!runid) {
		console.error('ERROR: No run ID. Specify --runid <id>');
		process.exit(1);
	}

	const key = `${opts.env}/${opts.scenario}/${runid}.json`;
	console.log(`Uploading: ${source} → ${s3Key(key)}`);
	awsCmd(`cp "${source}" "${s3Key(key)}"`);
	console.log('Done.');
}

function fetchBaseline() {
	const key = `${opts.env}/${opts.scenario}/baseline.json`;
	const dest = opts.dest || join(repoRoot, 'artifacts', 'k6', '.s3-baseline.json');

	console.log(`Fetching: ${s3Key(key)} → ${dest}`);
	const ok = awsCmd(`cp "${s3Key(key)}" "${dest}"`);
	if (!ok) {
		console.error(`No baseline found in S3 at: ${s3Key(key)}`);
		process.exit(1);
	}
	console.log(`Baseline downloaded: ${dest}`);
}

function setBaseline() {
	const latest = findLatestSummary();
	const source = opts.source || latest?.path;

	if (!source || !existsSync(source)) {
		console.error('ERROR: No source summary found.');
		process.exit(1);
	}

	const key = `${opts.env}/${opts.scenario}/baseline.json`;
	console.log(`Setting baseline: ${source} → ${s3Key(key)}`);
	awsCmd(`cp "${source}" "${s3Key(key)}"`);
	console.log('Done.');
}

// ── Dispatch ────────────────────────────────────────────────────
switch (opts.command) {
	case 'upload-summary':
		uploadSummary();
		break;
	case 'fetch-baseline':
		fetchBaseline();
		break;
	case 'set-baseline':
		setBaseline();
		break;
	default:
		console.error('Usage: s3.mjs <upload-summary|fetch-baseline|set-baseline> [options]');
		console.error('');
		console.error('Env vars:');
		console.error('  PERF_S3_BUCKET   S3 bucket name (required)');
		console.error('  PERF_S3_PREFIX   Key prefix (default: perf/k6)');
		console.error('  PERF_S3_REGION   AWS region override');
		console.error('');
		console.error('Options:');
		console.error('  --env <local|dev|stage>');
		console.error('  --scenario <name>');
		console.error('  --source <path>');
		console.error('  --dest <path>');
		console.error('  --runid <id>');
		process.exit(1);
}
