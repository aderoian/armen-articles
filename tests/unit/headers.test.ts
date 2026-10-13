import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, headersFile, inlineScriptHashes } from '@/lib/security/headers';

const sha = (body: string) =>
	`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

describe('inlineScriptHashes', () => {
	it('hashes inline executable scripts only', () => {
		const html = [
			'<script src="/scripts/theme-init.js"></script>',
			'<script type="application/ld+json">{"a":1}</script>',
			'<script type="module" src="/_astro/x.js"></script>',
			'<script>console.log(1)</script>',
			'<script type="module">import "x";</script>',
			'<script>   </script>'
		].join('');
		expect(inlineScriptHashes(html)).toEqual([sha('console.log(1)'), sha('import "x";')]);
	});
});

describe('contentSecurityPolicy', () => {
	it('allows only self-hosted scripts plus the given hashes', () => {
		const policy = contentSecurityPolicy([sha('b'), sha('a'), sha('a')]);
		const scriptSrc = policy.split('; ').find((directive) => directive.startsWith('script-src'));
		expect(scriptSrc).toBe(
			`script-src 'self' 'wasm-unsafe-eval' ${[sha('a'), sha('b')].sort().join(' ')}`
		);
		expect(policy).toContain("frame-ancestors 'none'");
		expect(policy).toContain("object-src 'none'");
		expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
	});
});

describe('headersFile', () => {
	it('sets security headers globally and long-lived caching for hashed assets', () => {
		const file = headersFile([]);
		expect(file).toMatch(/^\/\*\n {2}Content-Security-Policy: /);
		expect(file).toContain('X-Content-Type-Options: nosniff');
		expect(file).toContain('/_astro/*\n  Cache-Control: public, max-age=31536000, immutable');
	});
});
