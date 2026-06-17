#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  SCHEMA_VERSION,
  computeAssetId,
  verifyAssetId,
  canonicalize,
  GEP_GENE_CATEGORIES,
  GEP_OUTCOME_STATUSES,
} from '@evomap/gep-sdk';

function readStdin() {
  return readFileSync(0, 'utf8');
}

function stampAsset(asset) {
  if (!asset || typeof asset !== 'object') throw new Error('asset must be object');
  if (!asset.schema_version) asset.schema_version = SCHEMA_VERSION;
  asset.asset_id = computeAssetId(asset);
  return asset;
}

const cmd = process.argv[2] || 'info';

if (cmd === 'info') {
  console.log(JSON.stringify({
    ok: true,
    sdk: '@evomap/gep-sdk',
    schema_version: SCHEMA_VERSION,
    gene_categories: GEP_GENE_CATEGORIES,
    outcome_statuses: GEP_OUTCOME_STATUSES,
  }, null, 2));
} else if (cmd === 'stamp') {
  const asset = JSON.parse(readStdin());
  console.log(JSON.stringify(stampAsset(asset), null, 2));
} else if (cmd === 'verify') {
  const asset = JSON.parse(readStdin());
  console.log(JSON.stringify({ ok: verifyAssetId(asset), expected: computeAssetId(asset), claimed: asset.asset_id || null }, null, 2));
} else if (cmd === 'canonicalize') {
  const asset = JSON.parse(readStdin());
  process.stdout.write(canonicalize(asset));
} else {
  console.error('Usage: node scripts/gep_bridge.mjs info|stamp|verify|canonicalize');
  process.exit(2);
}
