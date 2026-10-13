/**
 * Post-build step: write `dist/_headers` for Cloudflare static assets with a
 * Content-Security-Policy that allows exactly the inline scripts Astro emitted.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { headersFile, inlineScriptHashes } from '../src/lib/security/headers.ts';

const dist = new URL('../dist/', import.meta.url).pathname;

async function htmlFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) return htmlFiles(path);
			return Promise.resolve(entry.name.endsWith('.html') ? [path] : []);
		})
	);
	return nested.flat();
}

const files = await htmlFiles(dist);
if (files.length === 0) {
	console.error('generate-headers: no HTML files found in dist/. Run `astro build` first.');
	process.exit(1);
}

const hashes = new Set<string>();
for (const file of files) {
	for (const hash of inlineScriptHashes(await readFile(file, 'utf8'))) hashes.add(hash);
}

await writeFile(join(dist, '_headers'), headersFile(hashes));
console.log(
	`generate-headers: wrote dist/_headers (${files.length} pages, ${hashes.size} inline script hashes)`
);
