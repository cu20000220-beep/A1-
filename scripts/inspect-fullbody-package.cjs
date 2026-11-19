#!/usr/bin/env node
'use strict';
// Offline intake only. This command never downloads, publishes or loads a model
// into the application. Its output is a review record, not a quality approval.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validatePackage } = require('./lib/fullbody-asset-policy.cjs');
const { inspectAsset, safeUri } = require('./lib/gltf-package-inspector.cjs');

function fail(code) { throw new TypeError(code); }

function snapshot(root, record) {
  const full = path.join(root, record.path);
  // Recheck after the policy pass and bind the bytes actually inspected to the
  // approved digest. A replacement file cannot reuse an earlier approval.
  let current = path.parse(full).root;
  for (const segment of full.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) fail('package_symlink_forbidden');
  }
  const fd = fs.openSync(full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size !== record.bytes) fail('package_file_changed');
    const bytes = fs.readFileSync(fd);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== record.sha256) {
      fail('package_file_hash_mismatch');
    }
    return bytes;
  } finally { fs.closeSync(fd); }
}

function inspectPackage(options = {}) {
  const policy = validatePackage(options);
  const root = path.resolve(options.packageDir);
  const files = new Map(policy.files.map(record => [record.path, snapshot(root, record)]));
  const models = [];
  const blockers = new Set(policy.blockers);
  for (const record of policy.files) {
    if (!/\.(glb|gltf)$/i.test(record.path)) continue;
    const inspection = inspectAsset(files.get(record.path), {
      filename: record.path,
      resolveResource(uri) {
        const relative = path.posix.join(path.posix.dirname(record.path), safeUri(uri));
        if (!files.has(relative)) fail('undeclared_asset_reference');
        return files.get(relative);
      }
    });
    if (!inspection.stats.vertices || !inspection.stats.triangles) {
      inspection.blockers.push('asset_empty_geometry');
    }
    for (const blocker of inspection.blockers) blockers.add(record.path + ':' + blocker);
    models.push({ path: record.path, role: record.role, ...inspection });
  }
  return {
    version: 1,
    status: blockers.size ? 'BLOCKED' : 'REVIEW_REQUIRED',
    assetId: policy.manifest.assetId,
    policy: {
      status: policy.status,
      blockers: policy.blockers,
      packageSha256: policy.packageSha256,
      licenceEvidenceSha256: policy.licenceEvidenceSha256,
      scopeSha256: policy.scopeSha256,
      totalBytes: policy.totalBytes,
      requiredRights: policy.requiredRights
    },
    models,
    blockers: [...blockers],
    integrationApproved: false,
    qualityVerified: false
  };
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('Offline, read-only full-body package inspection.\n' +
      'Usage: node scripts/inspect-fullbody-package.cjs --package DIR ' +
      '[--manifest manifest.json] [--approval approval.json]\n' +
      'Relative manifest/approval paths use DIR. JSON is written only to stdout.\n' +
      'Exit 0: visual review still required; 2: blocked; 1: invalid input.\n');
    return;
  }
  try {
    const values = new Map();
    for (let i = 0; i < args.length; i += 2) {
      if (!['--package', '--manifest', '--approval'].includes(args[i]) ||
          values.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
        fail('invalid_cli_arguments');
      }
      values.set(args[i], args[i + 1]);
    }
    if (!values.has('--package')) fail('invalid_cli_arguments');
    const packageDir = path.resolve(values.get('--package'));
    const control = key => values.has(key) ? path.resolve(packageDir, values.get(key)) : undefined;
    const report = inspectPackage({ packageDir, manifestPath: control('--manifest'), approvalPath: control('--approval') });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exitCode = report.status === 'BLOCKED' ? 2 : 0;
  } catch (error) {
    // Do not expose private package paths or file content in terminal/CI logs.
    const code = error instanceof TypeError && /^[a-z][a-z0-9_]{1,80}$/.test(error.message)
      ? error.message : 'package_inspection_failed';
    process.stdout.write(JSON.stringify({ version: 1, status: 'INVALID', error: code,
      integrationApproved: false, qualityVerified: false }) + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { inspectPackage };
