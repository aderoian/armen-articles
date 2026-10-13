import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const fixture = join(import.meta.dirname, '../fixtures/invalid-metadata');
const astro = join(import.meta.dirname, '../../node_modules/.bin/astro');

afterAll(() => {
	rmSync(join(fixture, '.astro'), { recursive: true, force: true });
	rmSync(join(fixture, 'node_modules'), { recursive: true, force: true });
});

describe('content validation', () => {
	it('fails the build with actionable messages when frontmatter is invalid', () => {
		const result = spawnSync(astro, ['sync', '--root', fixture], {
			encoding: 'utf8',
			env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' }
		});
		const output = `${result.stdout}\n${result.stderr}`;

		expect(result.status, output).not.toBe(0);
		expect(output).toContain('broken-article');
		expect(output).toMatch(/description is required/);
		expect(output).toMatch(/category must be one of "systems-programming", "graphics"/);
	});
});
