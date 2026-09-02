const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/exports/utils.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require });
const { exportStateMessage, isSuccessfulDownload, parseExportError, safeExportFilename } = moduleValue.exports;

test('creates safe portable journey export filenames', () => {
  assert.equal(safeExportFilename('../ Medina / Spring ', '2026'), 'Vialbum-Medina-Spring-2026.zip');
  assert.equal(safeExportFilename('✨', '2026'), 'Vialbum-Journey-2026.zip');
});

test('parses controlled API export failures and provides a fallback', () => {
  assert.equal(parseExportError('{"detail":"This export is too large"}', 422), 'This export is too large');
  assert.equal(parseExportError('not json', 500), 'Vialbum could not prepare this export. Please try again.');
  assert.equal(parseExportError('', 401), 'Your session has expired. Please sign in again.');
});

test('recognizes only successful download responses', () => {
  assert.equal(isSuccessfulDownload(200), true);
  assert.equal(isSuccessfulDownload(299), true);
  assert.equal(isSuccessfulDownload(401), false);
});

test('uses honest user-facing export states', () => {
  assert.match(exportStateMessage('preparing'), /Preparing and downloading/);
  assert.match(exportStateMessage('sharing'), /ready/);
  assert.equal(exportStateMessage('idle'), null);
});
