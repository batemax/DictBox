import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requestedTarget = process.argv[2];
const targets = requestedTarget ? [requestedTarget] : ['chromium', 'firefox'];
const supportedTargets = new Set(['chromium', 'firefox']);

for (const target of targets) {
  if (!supportedTargets.has(target)) {
    throw new Error(`Unsupported build target: ${target}`);
  }
}

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const baseManifest = await readJson('manifests/base.json');

for (const target of targets) {
  const outputDir = resolve(root, 'dist', target);
  const targetManifest = await readJson(`manifests/${target}.json`);
  const manifest = { ...baseManifest, ...targetManifest };

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    resolve(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  await cp(resolve(root, 'src'), resolve(outputDir, 'src'), { recursive: true });
  await cp(resolve(root, 'icons'), resolve(outputDir, 'icons'), { recursive: true });

  for (const file of ['options.html', 'options.css', 'LICENSE']) {
    await cp(resolve(root, file), resolve(outputDir, file));
  }

  console.log(`Built ${target}: ${outputDir}`);
}
