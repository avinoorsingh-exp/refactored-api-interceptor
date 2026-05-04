import { serializeRequestBodySnapshot } from '../../src/utils/serialize-request-body-snapshot.util.js';

describe('serializeRequestBodySnapshot', () => {
	it('returns undefined for undefined and null', () => {
		expect(serializeRequestBodySnapshot(undefined, 100)).toBeUndefined();
		expect(serializeRequestBodySnapshot(null, 100)).toBeUndefined();
	});

	it('JSON-stringifies plain objects', () => {
		expect(serializeRequestBodySnapshot({ a: 1, b: 'x' }, 10_000)).toBe('{"a":1,"b":"x"}');
	});

	it('returns strings with truncation when over maxBytes', () => {
		const long = 'a'.repeat(50);
		const out = serializeRequestBodySnapshot(long, 20);
		expect(out).toBeDefined();
		expect(Buffer.byteLength(out as string, 'utf8')).toBeLessThanOrEqual(20);
		expect(out).toContain('…[truncated]');
	});

	it('handles Buffer as a placeholder and respects maxBytes', () => {
		const buf = Buffer.alloc(100);
		const out = serializeRequestBodySnapshot(buf, 500);
		expect(out).toContain('[binary Buffer 100 bytes]');
	});

	it('uses JSON.stringify failure path for circular structures', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(serializeRequestBodySnapshot(circular, 200)).toBe('[unserializable object]');
	});

	it('stringifies primitives via String()', () => {
		expect(serializeRequestBodySnapshot(42, 50)).toBe('42');
		expect(serializeRequestBodySnapshot(true, 50)).toBe('true');
	});

	it('truncates JSON object output at UTF-8 boundaries without expanding past maxBytes', () => {
		const body = { text: 'é'.repeat(100) };
		const raw = JSON.stringify(body);
		expect(Buffer.byteLength(raw, 'utf8')).toBeGreaterThan(40);
		const out = serializeRequestBodySnapshot(body, 40);
		expect(out).toBeDefined();
		expect(Buffer.byteLength(out as string, 'utf8')).toBeLessThanOrEqual(40);
		expect(out).toContain('…[truncated]');
		expect(out).not.toContain('\uFFFD');
	});

	it('returns short JSON without truncation when under limit', () => {
		expect(serializeRequestBodySnapshot({ ok: true }, 256)).toBe('{"ok":true}');
	});
});
