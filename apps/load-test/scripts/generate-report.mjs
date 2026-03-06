#!/usr/bin/env node
/**
 * generate-report.mjs
 *
 * Reads k6-summary.json and produces:
 *   - k6-summary.md   (Jira-friendly markdown)
 *   - k6-report.html  (self-contained HTML report)
 *
 * Usage:
 *   node apps/load-test/scripts/generate-report.mjs <artifact-dir> [scenario-name] [base-url]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const artifactDir = process.argv[2];
const scenario = process.argv[3] || 'unknown';
const baseUrl = process.argv[4] || '';

if (!artifactDir) {
	console.error('Usage: generate-report.mjs <artifact-dir> [scenario] [base-url]');
	process.exit(1);
}

const summaryPath = join(artifactDir, 'k6-summary.json');
let summary;
try {
	summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch (err) {
	console.error(`Failed to read ${summaryPath}: ${err.message}`);
	process.exit(1);
}

// ── Extract metrics ──────────────────────────────────────────────
const metrics = summary.metrics || {};

function getStat(metricName, stat) {
	const m = metrics[metricName];
	if (!m) return 'N/A';
	const values = m.values || m;
	return values[stat] !== undefined ? values[stat] : 'N/A';
}

function fmtMs(val) {
	if (val === 'N/A') return 'N/A';
	return `${Math.round(val)}ms`;
}

function fmtRate(val) {
	if (val === 'N/A') return 'N/A';
	return `${(val * 100).toFixed(2)}%`;
}

const totalRequests = getStat('http_reqs', 'count');
const errRate = getStat('http_req_failed', 'rate');
const p50 = getStat('http_req_duration', 'med');
const p90 = getStat('http_req_duration', 'p(90)');
const p95 = getStat('http_req_duration', 'p(95)');
const p99 = getStat('http_req_duration', 'p(99)');
const avg = getStat('http_req_duration', 'avg');
const max = getStat('http_req_duration', 'max');

// Thresholds pass/fail
const thresholds = summary.thresholds || {};
const thresholdResults = Object.entries(thresholds).map(([name, t]) => {
	const ok = t.ok !== undefined ? t.ok : (t.thresholds ? t.thresholds.every(th => th.ok) : true);
	return { name, ok };
});
const allPassed = thresholdResults.every(t => t.ok);
const status = allPassed ? 'PASS' : 'FAIL';

// VUs and duration from root_group or options
const vus = getStat('vus_max', 'value');
const duration = getStat('http_req_duration', 'count') !== 'N/A' ? '' : '';

// ── Markdown report ──────────────────────────────────────────────
const md = `# k6 Run Summary

| Field | Value |
|-------|-------|
| Scenario | ${scenario} |
| Base URL | ${baseUrl || 'N/A'} |
| Status | **${status}** |
| Total Requests | ${totalRequests} |
| Max VUs | ${vus} |
| Error Rate | ${fmtRate(errRate)} |

## Latency

| Stat | Value |
|------|-------|
| avg | ${fmtMs(avg)} |
| p50 | ${fmtMs(p50)} |
| p90 | ${fmtMs(p90)} |
| p95 | ${fmtMs(p95)} |
| p99 | ${fmtMs(p99)} |
| max | ${fmtMs(max)} |

## Thresholds

| Threshold | Result |
|-----------|--------|
${thresholdResults.map(t => `| ${t.name} | ${t.ok ? 'PASS' : 'FAIL'} |`).join('\n')}

---
_Generated from k6-summary.json_
`;

writeFileSync(join(artifactDir, 'k6-summary.md'), md);
console.log(`Written: ${join(artifactDir, 'k6-summary.md')}`);

// ── HTML report ──────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>k6 Report — ${scenario}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #333; }
  h1 { border-bottom: 2px solid #4a90d9; padding-bottom: 0.5rem; }
  .status { font-size: 1.2rem; font-weight: bold; padding: 0.3rem 0.8rem; border-radius: 4px; display: inline-block; }
  .pass { background: #d4edda; color: #155724; }
  .fail { background: #f8d7da; color: #721c24; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f5f5f5; }
  tr:nth-child(even) { background: #fafafa; }
  .section { margin-top: 2rem; }
</style>
</head>
<body>
<h1>k6 Report</h1>
<p><span class="status ${allPassed ? 'pass' : 'fail'}">${status}</span></p>

<table>
  <tr><th>Scenario</th><td>${scenario}</td></tr>
  <tr><th>Base URL</th><td>${baseUrl || 'N/A'}</td></tr>
  <tr><th>Total Requests</th><td>${totalRequests}</td></tr>
  <tr><th>Max VUs</th><td>${vus}</td></tr>
  <tr><th>Error Rate</th><td>${fmtRate(errRate)}</td></tr>
</table>

<div class="section">
<h2>Latency</h2>
<table>
  <tr><th>Stat</th><th>Value</th></tr>
  <tr><td>avg</td><td>${fmtMs(avg)}</td></tr>
  <tr><td>p50</td><td>${fmtMs(p50)}</td></tr>
  <tr><td>p90</td><td>${fmtMs(p90)}</td></tr>
  <tr><td>p95</td><td>${fmtMs(p95)}</td></tr>
  <tr><td>p99</td><td>${fmtMs(p99)}</td></tr>
  <tr><td>max</td><td>${fmtMs(max)}</td></tr>
</table>
</div>

<div class="section">
<h2>Thresholds</h2>
<table>
  <tr><th>Threshold</th><th>Result</th></tr>
  ${thresholdResults.map(t => `<tr><td>${t.name}</td><td class="${t.ok ? 'pass' : 'fail'}">${t.ok ? 'PASS' : 'FAIL'}</td></tr>`).join('\n  ')}
</table>
</div>

<p style="color:#999; font-size:0.85rem; margin-top:2rem;">Generated from k6-summary.json</p>
</body>
</html>`;

writeFileSync(join(artifactDir, 'k6-report.html'), html);
console.log(`Written: ${join(artifactDir, 'k6-report.html')}`);
