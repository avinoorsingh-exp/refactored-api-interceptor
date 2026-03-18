#!/usr/bin/env node
/**
 * history.mjs — Local performance history management.
 *
 * Commands:
 *   save-baseline  — Copy a summary as the baseline for env/scenario
 *   save-run       — Copy a summary to runs history
 *   list-runs      — List recent runs for env/scenario
 *
 * Usage:
 *   node apps/load-test/scripts/history.mjs save-baseline --env dev --scenario baseline [--source <path>]
 *   node apps/load-test/scripts/history.mjs save-run --env dev --scenario baseline --runid <id> [--source <path>]
 *   node apps/load-test/scripts/history.mjs list-runs --env dev --scenario baseline
 *
 * Paths:
 *   artifacts-history/k6/<env>/<scenario>/baseline.json
 *   artifacts-history/k6/<env>/<scenario>/runs/<runid>.json
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const historyRoot = join(repoRoot, 'artifacts-history', 'k6');

// ── Parse args ──────────────────────────────────────────────────
function parseArgs() {
	const args = process.argv.slice(2);
	const opts = {
		command: args[0],
		env: 'local',
		scenario: 'baseline',
		source: null,
		runid: null,
	};

	for (let i = 1; i < args.length; i++) {
		switch (args[i]) {
			case '--env': opts.env = args[++i]; break;
			case '--scenario': opts.scenario = args[++i]; break;
			case '--source': opts.source = args[++i]; break;
			case '--runid': opts.runid = args[++i]; break;
		}
	}
	return opts;
}

const opts = parseArgs();

// ── Find latest summary if source not specified ─────────────────
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

function saveBaseline() {
	const source = opts.source || findLatestSummary()?.path;
	if (!source || !existsSync(source)) {
		console.error('ERROR: No source summary found.');
		console.error('  Run a k6 test first, or specify --source <path>');
		process.exit(1);
	}

	const destDir = join(historyRoot, opts.env, opts.scenario);
	mkdirSync(destDir, { recursive: true });
	const dest = join(destDir, 'baseline.json');
	copyFileSync(source, dest);
	console.log(`Baseline saved: ${dest}`);
	console.log(`  Source: ${source}`);
	console.log(`  Env: ${opts.env}, Scenario: ${opts.scenario}`);
}

function saveRun() {
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

	const destDir = join(historyRoot, opts.env, opts.scenario, 'runs');
	mkdirSync(destDir, { recursive: true });
	const dest = join(destDir, `${runid}.json`);
	copyFileSync(source, dest);
	console.log(`Run saved: ${dest}`);
}

function listRuns() {
	const runsDir = join(historyRoot, opts.env, opts.scenario, 'runs');
	const baselinePath = join(historyRoot, opts.env, opts.scenario, 'baseline.json');

	console.log(`History for env=${opts.env}, scenario=${opts.scenario}`);
	console.log(`  Baseline: ${existsSync(baselinePath) ? 'YES' : 'NOT SET'}`);

	if (!existsSync(runsDir)) {
		console.log('  Runs: none');
		return;
	}

	const runs = readdirSync(runsDir)
		.filter((f) => f.endsWith('.json'))
		.sort()
		.reverse();

	console.log(`  Runs (${runs.length}):`);
	for (const r of runs.slice(0, 20)) {
		console.log(`    - ${r.replace('.json', '')}`);
	}
	if (runs.length > 20) {
		console.log(`    ... and ${runs.length - 20} more`);
	}
}

// ── Dispatch ────────────────────────────────────────────────────
switch (opts.command) {
	case 'save-baseline':
		saveBaseline();
		break;
	case 'save-run':
		saveRun();
		break;
	case 'list-runs':
		listRuns();
		break;
	default:
		console.error('Usage: history.mjs <save-baseline|save-run|list-runs> [options]');
		console.error('');
		console.error('Options:');
		console.error('  --env <local|dev|stage>     Environment (default: local)');
		console.error('  --scenario <name>            Scenario name (default: baseline)');
		console.error('  --source <path>              Source summary JSON (default: latest)');
		console.error('  --runid <id>                 Run ID for save-run');
		process.exit(1);
}
