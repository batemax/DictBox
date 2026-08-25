import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

test('Manifest V3 exposes the popup, options and Omnibox entry points', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '3.0.0');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.equal(manifest.options_page, 'options.html');
  assert.equal(manifest.omnibox.keyword, 'db');
  assert.equal(manifest.background.type, 'module');
});

test('extension pages use external module scripts compatible with MV3 CSP', async () => {
  for (const path of ['popup.html', 'result.html', 'options.html']) {
    const html = await read(path);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/iu, `${path} has an inline script`);
    assert.match(html, /<script[^>]+type="module"[^>]+src=/iu, `${path} lacks a module entry`);
  }
});

test('runtime UI does not inject HTML strings', async () => {
  const paths = [
    'src/popup/index.js',
    'src/result/index.js',
    'src/options/index.js',
    'src/ui/dom.js',
  ];
  for (const path of paths) {
    const source = await read(path);
    assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/u, path);
  }
});

test('production defaults provide keyless automatic lookup', async () => {
  const source = await read('src/shared/settings.js');
  assert.match(source, /provider:\s*'mymemory'/u);
  assert.match(source, /sourceLang:\s*'auto'/u);
  assert.match(source, /useMockData:\s*false/u);
});

test('settings protect destructive reset and custom host access', async () => {
  const [html, source] = await Promise.all([
    read('options.html'),
    read('src/options/index.js'),
  ]);
  assert.match(html, /<dialog[^>]+id="reset-dialog"/u);
  assert.match(html, /测试并保存/u);
  assert.doesNotMatch(html, /href="popup\.html"/u);
  assert.match(source, /api\.permissions\.request/u);
  assert.match(source, /resetDialog\.returnValue\s*!==\s*'confirm'/u);
});

test('result homepage never hardcodes or automatically queries world', async () => {
  const [html, source] = await Promise.all([
    read('result.html'),
    read('src/result/index.js'),
  ]);
  assert.doesNotMatch(html, /word=world/u);
  assert.doesNotMatch(source, /\|\|\s*'world'/u);
  assert.match(source, /if \(!query\) \{\s*showEmptyState\(\)/u);
});

test('popup copy supports multilingual words and phrases', async () => {
  const html = await read('popup.html');
  assert.match(html, /输入单词或短语/u);
  assert.doesNotMatch(html, /输入英文单词/u);
  assert.match(html, /db \+ 空格/u);
});
