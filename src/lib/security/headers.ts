import { createHash } from 'node:crypto';

// Kept free of path aliases so `scripts/generate-headers.ts` can run it directly with Node.

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * SHA-256 CSP sources for every inline *executable* script in an HTML document.
 * External scripts (`src=`) are covered by `'self'`; JSON-LD is data, not code.
 */
export function inlineScriptHashes(html: string): string[] {
	const hashes: string[] = [];
	for (const [, attributes = '', body = ''] of html.matchAll(INLINE_SCRIPT)) {
		if (/\bsrc\s*=/i.test(attributes)) continue;
		if (/\btype\s*=\s*["']?application\/ld\+json/i.test(attributes)) continue;
		if (body.trim() === '') continue;
		hashes.push(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
	}
	return hashes;
}

export function contentSecurityPolicy(scriptHashes: Iterable<string>): string {
	const hashes = [...new Set(scriptHashes)].sort();
	return [
		"default-src 'self'",
		// Pagefind compiles its search engine from WebAssembly.
		["script-src 'self' 'wasm-unsafe-eval'", ...hashes].join(' '),
		// KaTeX positions glyphs with style attributes and Mermaid emits <style> in its SVGs.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	].join('; ');
}

/** Cloudflare static-asset `_headers` file contents. */
export function headersFile(scriptHashes: Iterable<string>): string {
	return [
		'/*',
		`  Content-Security-Policy: ${contentSecurityPolicy(scriptHashes)}`,
		'  X-Content-Type-Options: nosniff',
		'  X-Frame-Options: DENY',
		'  Referrer-Policy: strict-origin-when-cross-origin',
		'  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'  Cross-Origin-Opener-Policy: same-origin',
		'',
		'/_astro/*',
		'  Cache-Control: public, max-age=31536000, immutable',
		'',
		'/pagefind/*',
		'  Cache-Control: public, max-age=3600, must-revalidate',
		''
	].join('\n');
}
