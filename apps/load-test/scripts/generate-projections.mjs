#!/usr/bin/env node

// Scans projection config TS files and extracts required/allowed/default/relations
// into a JSON file for use by k6 load test parameterization.
//
// Usage:
//   node apps/load-test/scripts/generate-projections.mjs
//
// Output:
//   apps/load-test/src/generated/projections.json

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';

// ── Config ──────────────────────────────────────────────────────

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'apps/load-test/src/generated');
const OUT_FILE = resolve(OUT_DIR, 'projections.json');

function walkDir(dir, results) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith('-projection.config.ts')) {
      results.push(full);
    }
  }
}

/**
 * Extract a string array from a TS source like:
 *   required: ['id', 'name'],
 *   allowed: [\n    'id',\n    'name',\n  ],
 *
 * Handles both single-line and multi-line arrays.
 */
function extractStringArray(source, fieldName) {
  // Match field: [ ... ] allowing newlines
  const regex = new RegExp(`${fieldName}\\s*:\\s*\\[([^\\]]*?)\\]`, 's');
  const match = source.match(regex);
  if (!match) return [];
  // Extract quoted strings
  const items = [];
  const strRegex = /['"]([^'"]+)['"]/g;
  let m;
  while ((m = strRegex.exec(match[1])) !== null) {
    items.push(m[1]);
  }
  return items;
}

/**
 * Extract relation property values from inside each relation block.
 * e.g. property: 'payPlanVariants' → 'payPlanVariants'
 * Returns a Set of property values for filtering.
 */
function extractRelationProperties(source) {
  const props = new Set();
  const regex = /property\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  // Only match inside the relations block
  const relationsStart = source.indexOf('relations:');
  if (relationsStart === -1) return props;
  const sub = source.substring(relationsStart);
  while ((m = regex.exec(sub)) !== null) {
    props.add(m[1]);
  }
  return props;
}

/**
 * Extract relation keys from:
 *   relations: {
 *     office: { ... },
 *     mls: { ... },
 *   }
 *
 * Returns the top-level keys of the relations object.
 */
function extractRelationKeys(source) {
  // Find the relations block
  const relationsStart = source.indexOf('relations:');
  if (relationsStart === -1) return [];

  // Find the opening brace
  const braceStart = source.indexOf('{', relationsStart + 'relations:'.length);
  if (braceStart === -1) return [];

  // Find matching closing brace (handle nesting)
  let depth = 1;
  let pos = braceStart + 1;
  while (pos < source.length && depth > 0) {
    if (source[pos] === '{') depth++;
    else if (source[pos] === '}') depth--;
    pos++;
  }
  const relationsBlock = source.substring(braceStart + 1, pos - 1);

  // Extract top-level keys: they appear as identifiers followed by ':'
  // at depth 0 within the relations block
  const keys = [];
  depth = 0;
  let current = '';
  for (let i = 0; i < relationsBlock.length; i++) {
    const ch = relationsBlock[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
    } else if (depth === 0) {
      if (ch === ':' && current.trim()) {
        // Found a key at top level
        const key = current.trim();
        // Skip if it looks like a nested property (property:, fields:, etc.)
        if (key && !key.includes('\n') && !key.includes(' ')) {
          keys.push(key);
        } else {
          // Multi-line key: take the last word
          const lines = key.split('\n');
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine) keys.push(lastLine);
        }
        current = '';
      } else if (ch === ',' || ch === '\n') {
        current = '';
      } else {
        current += ch;
      }
    }
  }

  return keys;
}

/**
 * Derive a short module name from the file path.
 * e.g. agent-projection.config.ts → agents
 *      agent-company-projection.config.ts → agent-companies
 *      agent-company-association-projection.config.ts → agent-company-associations
 */
function deriveModuleName(filePath) {
  const file = basename(filePath);
  // Remove -projection.config.ts suffix
  const stem = file.replace(/-projection\.config\.ts$/, '');

  // Pluralize: simple rules
  const PLURAL_MAP = {
    'agent': 'agents',
    'agent-company': 'agent-companies',
    'agent-company-association': 'agent-company-associations',
    'office': 'offices',
    'state': 'states',
    'mls': 'mls',
    'pay-plan': 'pay-plans',
  };

  if (PLURAL_MAP[stem]) return PLURAL_MAP[stem];

  // Default: add 's' unless already ends with 's'
  if (stem.endsWith('s')) return stem;
  return stem + 's';
}

// ── Main ────────────────────────────────────────────────────────

function main() {
  const modulesDir = resolve(REPO_ROOT, 'services/agent-service/src/modules');
  const files = [];
  walkDir(modulesDir, files);

  if (files.length === 0) {
    console.error('No projection config files found');
    process.exit(1);
  }

  console.log(`Found ${files.length} projection config(s):`);

  const projections = {};

  for (const file of files) {
    const source = readFileSync(file, 'utf-8');
    const moduleName = deriveModuleName(file);

    const required = extractStringArray(source, 'required');
    const allowed = extractStringArray(source, 'allowed');
    const defaultFields = extractStringArray(source, 'default');
    const relations = extractRelationKeys(source);

    // Filter allowed to only non-relation scalar fields
    // Exclude both relation keys and their property values (e.g. payPlanVariant + payPlanVariants)
    const relationSet = new Set(relations);
    const relationProps = extractRelationProperties(source);
    const isRelation = (f) => relationSet.has(f) || relationProps.has(f);
    const scalarAllowed = allowed.filter((f) => !isRelation(f));

    projections[moduleName] = {
      required,
      allowed: scalarAllowed,
      default: defaultFields.filter((f) => !isRelation(f)),
      relations,
    };

    const rel = file.replace(REPO_ROOT + '/', '');
    console.log(`  ${moduleName} — ${rel}`);
    console.log(`    required: ${required.length}, allowed: ${scalarAllowed.length}, default: ${defaultFields.length}, relations: ${relations.length}`);
  }

  // Write output
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(projections, null, 2) + '\n');
  console.log(`\nWrote ${OUT_FILE.replace(REPO_ROOT + '/', '')}`);
}

main();
