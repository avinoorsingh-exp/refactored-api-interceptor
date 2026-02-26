#!/usr/bin/env node
// compare-summaries.mjs
//
// Compares a current k6 summary against a baseline and produces:
//   - regression.json (machine-readable diffs + flags)
//   - regression.md   (Jira-friendly summary)
//
// Usage:
//   node apps/load-test/scripts/compare-summaries.mjs
//     --current <path>      (default: latest artifacts/k6/<runid>/k6-summary.json)
//     --baseline <path>     (default: artifacts-history/k6/<env>/<scenario>/baseline.json)
//     --outdir <path>       (default: same dir as current)
//     --env <local|dev|stage>
//     --scenario <smoke|baseline|stress>
//
// Env var overrides for thresholds:
//   REGRESS_P95_PCT=15          (global p95 drift %)
//   REGRESS_P99_PCT=20          (global p99 drift %)
//   REGRESS_ERR_ABS=0.005       (error rate absolute drift)
//   REGRESS_HOTSPOT_P95_PCT=20  (hotspot endpoint p95 drift %)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

// ── Parse CLI args ──────────────────────────────────────────────
function parseArgs() {
	const args = process.argv.slice(2);
	const opts = {
		current: null,
		baseline: null,
		outdir: null,
		env: process.env.PERF_ENV || 'local',
		scenario: process.env.PERF_SCENARIO || null,
	};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--current': opts.current = args[++i]; break;
			case '--baseline': opts.baseline = args[++i]; break;
			case '--outdir': opts.outdir = args[++i]; break;
			case '--env': opts.env = args[++i]; break;
			case '--scenario': opts.scenario = args[++i]; break;
		}
	}
	return opts;
}

const opts = parseArgs();

// ── Thresholds ──────────────────────────────────────────────────
const THRESHOLDS = {
	p95Pct: parseFloat(process.env.REGRESS_P95_PCT || '15'),
	p99Pct: parseFloat(process.env.REGRESS_P99_PCT || '20'),
	errAbs: parseFloat(process.env.REGRESS_ERR_ABS || '0.005'),
	hotspotP95Pct: parseFloat(process.env.REGRESS_HOTSPOT_P95_PCT || '20'),
};

// ── Resolve current summary path ────────────────────────────────
function findLatestSummary() {
	const k6Dir = join(repoRoot, 'artifacts', 'k6');
	if (!existsSync(k6Dir)) return null;
	const runs = readdirSync(k6Dir)
		.filter((d) => existsSync(join(k6Dir, d, 'k6-summary.json')))
		.sort()
		.reverse();
	return runs.length > 0 ? join(k6Dir, runs[0], 'k6-summary.json') : null;
}

const currentPath = opts.current || findLatestSummary();
if (!currentPath || !existsSync(currentPath)) {
	console.error('ERROR: No current summary found.');
	console.error('  Run a k6 test first: pnpm loadtest:baseline');
	console.error('  Or specify: --current <path>');
	process.exit(1);
}

// Infer scenario from path if not specified
if (!opts.scenario) {
	// Try to infer from k6.log or folder context
	const dir = dirname(currentPath);
	const logPath = join(dir, 'k6.log');
	if (existsSync(logPath)) {
		const log = readFileSync(logPath, 'utf8').substring(0, 500);
		for (const s of ['smoke', 'baseline', 'stress']) {
			if (log.includes(`scenarios/${s}.js`)) {
				opts.scenario = s;
				break;
			}
		}
	}
	if (!opts.scenario) opts.scenario = 'baseline';
}

// ── Resolve baseline path ───────────────────────────────────────
const baselinePath = opts.baseline ||
	join(repoRoot, 'artifacts-history', 'k6', opts.env, opts.scenario, 'baseline.json');

if (!existsSync(baselinePath)) {
	console.error(`No baseline found at: ${baselinePath}`);
	console.error('');
	console.error('Save a baseline first:');
	console.error(`  node apps/load-test/scripts/history.mjs save-baseline --env ${opts.env} --scenario ${opts.scenario} --source ${currentPath}`);
	console.error('');
	console.error('Or specify: --baseline <path>');
	process.exit(1);
}

// ── Load summaries ──────────────────────────────────────────────
const current = JSON.parse(readFileSync(currentPath, 'utf8'));
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const curMetrics = current.metrics || {};
const baseMetrics = baseline.metrics || {};

// ── Helpers ─────────────────────────────────────────────────────
function getStat(metrics, name, stat) {
	const m = metrics[name];
	if (!m) return null;
	const v = m.values || m;
	return v[stat] !== undefined ? v[stat] : null;
}

function pctDrift(current, baseline) {
	if (baseline === null || baseline === 0) return null;
	if (current === null) return null;
	return ((current - baseline) / baseline) * 100;
}

function absDrift(current, baseline) {
	if (current === null || baseline === null) return null;
	return current - baseline;
}

function fmtMs(v) { return v !== null ? `${Math.round(v)}ms` : 'N/A'; }
function fmtPct(v) { return v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : 'N/A'; }
function fmtRate(v) { return v !== null ? `${(v * 100).toFixed(2)}%` : 'N/A'; }

// ── Compare global metrics ──────────────────────────────────────
const results = {
	timestamp: new Date().toISOString(),
	env: opts.env,
	scenario: opts.scenario,
	currentPath,
	baselinePath,
	thresholds: THRESHOLDS,
	global: {},
	hotspots: [],
	regressions: [],
	summary: { hasRegression: false, regressionCount: 0, totalChecks: 0 },
};

function checkGlobal(name, stat, thresholdPct, thresholdAbs) {
	const cur = getStat(curMetrics, name, stat);
	const base = getStat(baseMetrics, name, stat);
	const drift = thresholdAbs !== undefined ? absDrift(cur, base) : pctDrift(cur, base);
	const threshold = thresholdAbs !== undefined ? thresholdAbs : thresholdPct;
	const regressed = drift !== null && drift > threshold;

	const entry = { metric: name, stat, current: cur, baseline: base, drift, threshold, regressed };
	results.global[`${name}.${stat}`] = entry;
	results.summary.totalChecks++;
	if (regressed) {
		results.regressions.push({ type: 'global', ...entry });
		results.summary.regressionCount++;
		results.summary.hasRegression = true;
	}
	return entry;
}

checkGlobal('http_req_duration', 'p(95)', THRESHOLDS.p95Pct);
checkGlobal('http_req_duration', 'p(99)', THRESHOLDS.p99Pct);
checkGlobal('http_req_failed', 'rate', undefined, THRESHOLDS.errAbs);

// Also track avg/p50/p90/max for reporting (no regression flag)
for (const stat of ['avg', 'med', 'p(90)', 'max']) {
	const cur = getStat(curMetrics, 'http_req_duration', stat);
	const base = getStat(baseMetrics, 'http_req_duration', stat);
	results.global[`http_req_duration.${stat}`] = {
		metric: 'http_req_duration', stat, current: cur, baseline: base,
		drift: pctDrift(cur, base), threshold: null, regressed: false,
	};
}

// ── Compare hotspot metrics ─────────────────────────────────────
const hsPrefix = 'hs_';
const hotspotMetrics = Object.keys(curMetrics).filter((k) => k.startsWith(hsPrefix));
const baselineHotspots = Object.keys(baseMetrics).filter((k) => k.startsWith(hsPrefix));
const allHotspotKeys = [...new Set([...hotspotMetrics, ...baselineHotspots])];

for (const key of allHotspotKeys.sort()) {
	const curP95 = getStat(curMetrics, key, 'p(95)');
	const baseP95 = getStat(baseMetrics, key, 'p(95)');
	const curP99 = getStat(curMetrics, key, 'p(99)');
	const baseP99 = getStat(baseMetrics, key, 'p(99)');

	const driftP95 = pctDrift(curP95, baseP95);
	const driftP99 = pctDrift(curP99, baseP99);
	const regressedP95 = driftP95 !== null && driftP95 > THRESHOLDS.hotspotP95Pct;
	const regressedP99 = driftP99 !== null && driftP99 > THRESHOLDS.hotspotP95Pct;

	const entry = {
		metric: key,
		p95: { current: curP95, baseline: baseP95, drift: driftP95, regressed: regressedP95 },
		p99: { current: curP99, baseline: baseP99, drift: driftP99, regressed: regressedP99 },
	};
	results.hotspots.push(entry);
	results.summary.totalChecks += 2;

	if (regressedP95) {
		results.regressions.push({ type: 'hotspot', metric: key, stat: 'p(95)', ...entry.p95, threshold: THRESHOLDS.hotspotP95Pct });
		results.summary.regressionCount++;
		results.summary.hasRegression = true;
	}
	if (regressedP99) {
		results.regressions.push({ type: 'hotspot', metric: key, stat: 'p(99)', ...entry.p99, threshold: THRESHOLDS.hotspotP95Pct });
		results.summary.regressionCount++;
		results.summary.hasRegression = true;
	}
}

// ── Write outputs ───────────────────────────────────────────────
const outDir = opts.outdir || dirname(currentPath);
mkdirSync(outDir, { recursive: true });

// JSON output
writeFileSync(join(outDir, 'regression.json'), JSON.stringify(results, null, 2));
console.log(`Written: ${join(outDir, 'regression.json')}`);

// Markdown output
const status = results.summary.hasRegression ? 'REGRESSION DETECTED' : 'NO REGRESSION';
const statusEmoji = results.summary.hasRegression ? '🔴' : '🟢';

let md = `# Performance Regression Report

| Field | Value |
|-------|-------|
| Status | **${status}** |
| Environment | ${opts.env} |
| Scenario | ${opts.scenario} |
| Checks | ${results.summary.totalChecks} |
| Regressions | ${results.summary.regressionCount} |

## Global Metrics

| Metric | Baseline | Current | Drift | Threshold | Result |
|--------|----------|---------|-------|-----------|--------|
`;

const g = results.global;
const gp95 = g['http_req_duration.p(95)'];
const gp99 = g['http_req_duration.p(99)'];
const gErr = g['http_req_failed.rate'];
const gAvg = g['http_req_duration.avg'];
const gP50 = g['http_req_duration.med'];
const gP90 = g['http_req_duration.p(90)'];
const gMax = g['http_req_duration.max'];

function globalRow(label, entry, isMs, thresholdLabel, isAbsDrift) {
	const fmt = isMs ? fmtMs : fmtRate;
	let driftStr = 'N/A';
	if (entry.drift !== null) {
		driftStr = isAbsDrift
			? `${entry.drift >= 0 ? '+' : ''}${(entry.drift * 100).toFixed(2)}pp`
			: fmtPct(entry.drift);
	}
	const result = entry.regressed ? '**REGRESSED**' : (entry.threshold !== null ? 'OK' : '—');
	return `| ${label} | ${fmt(entry.baseline)} | ${fmt(entry.current)} | ${driftStr} | ${thresholdLabel || '—'} | ${result} |`;
}

md += globalRow('p95 latency', gp95, true, `+${THRESHOLDS.p95Pct}%`) + '\n';
md += globalRow('p99 latency', gp99, true, `+${THRESHOLDS.p99Pct}%`) + '\n';
md += globalRow('Error rate', gErr, false, `+${(THRESHOLDS.errAbs * 100).toFixed(1)}pp abs`, true) + '\n';
md += globalRow('avg latency', gAvg, true) + '\n';
md += globalRow('p50 latency', gP50, true) + '\n';
md += globalRow('p90 latency', gP90, true) + '\n';
md += globalRow('max latency', gMax, true) + '\n';

// Hotspot section
if (results.hotspots.length > 0) {
	md += `\n## Hotspot Endpoints\n\n`;
	md += `| Metric | p95 Base | p95 Curr | p95 Drift | p99 Base | p99 Curr | p99 Drift | Result |\n`;
	md += `|--------|----------|----------|-----------|----------|----------|-----------|--------|\n`;

	for (const hs of results.hotspots) {
		const p95d = hs.p95.drift !== null ? fmtPct(hs.p95.drift) : 'N/A';
		const p99d = hs.p99.drift !== null ? fmtPct(hs.p99.drift) : 'N/A';
		const reg = (hs.p95.regressed || hs.p99.regressed) ? '**REGRESSED**' : 'OK';
		md += `| ${hs.metric} | ${fmtMs(hs.p95.baseline)} | ${fmtMs(hs.p95.current)} | ${p95d} | ${fmtMs(hs.p99.baseline)} | ${fmtMs(hs.p99.current)} | ${p99d} | ${reg} |\n`;
	}
}

// Top regressions
if (results.regressions.length > 0) {
	md += `\n## Top Regressions\n\n`;
	// Sort by drift descending
	const sorted = [...results.regressions].sort((a, b) => (b.drift || 0) - (a.drift || 0));
	for (const r of sorted.slice(0, 10)) {
		const driftStr = r.drift !== null ? fmtPct(r.drift) : 'N/A';
		md += `- **${r.metric}** ${r.stat || ''}: ${driftStr} (threshold: +${r.threshold}${r.type === 'global' && r.metric === 'http_req_failed' ? ' abs' : '%'})\n`;
	}
}

md += `\n---\n_Thresholds: p95=${THRESHOLDS.p95Pct}%, p99=${THRESHOLDS.p99Pct}%, err=${(THRESHOLDS.errAbs * 100).toFixed(1)}% abs, hotspot p95=${THRESHOLDS.hotspotP95Pct}%_\n`;

writeFileSync(join(outDir, 'regression.md'), md);
console.log(`Written: ${join(outDir, 'regression.md')}`);

// Exit summary
if (results.summary.hasRegression) {
	console.error(`\n${statusEmoji} ${status}: ${results.summary.regressionCount} regression(s) found`);
	process.exit(1);
} else {
	console.log(`\n${statusEmoji} ${status}`);
}
