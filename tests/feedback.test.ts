import { describe, expect, it } from 'vitest';
import { cleanText, csvCell, keyMatches, parseFeedback } from '../src/worker/feedback-core';

const base = { lineId: 'ne-001', lang: 'Nepali', vote: 'down', deviceId: 'abcdef12-3456' };

describe('parseFeedback', () => {
  it('accepts a good body and strips control characters', () => {
    const r = parseFeedback({ ...base, text: 'bad\u0000 word\n\there‮' });
    expect(typeof r).toBe('object');
    expect((r as { text: string }).text).toBe('bad word here');
  });
  it('rejects long ids, long text, bad votes and bad devices', () => {
    expect(typeof parseFeedback({ ...base, lineId: 'x'.repeat(41) })).toBe('string');
    expect(typeof parseFeedback({ ...base, text: 'y'.repeat(301) })).toBe('string');
    expect(typeof parseFeedback({ ...base, vote: 'meh' })).toBe('string');
    expect(typeof parseFeedback({ ...base, deviceId: 'short' })).toBe('string');
    expect(typeof parseFeedback(null)).toBe('string');
    expect(typeof parseFeedback({ ...base, lineId: '' })).toBe('string');
  });
  it('allows exactly 300 characters and no text', () => {
    expect(typeof parseFeedback({ ...base, text: 'z'.repeat(300) })).toBe('object');
    expect((parseFeedback({ ...base }) as { text: string }).text).toBe('');
  });
});

describe('keyMatches', () => {
  it('only matches the exact secret, and never when none is set', async () => {
    expect(await keyMatches('s3cret', 's3cret')).toBe(true);
    expect(await keyMatches('s3cre', 's3cret')).toBe(false);
    expect(await keyMatches('s3cret', undefined)).toBe(false);
    expect(await keyMatches(null, 's3cret')).toBe(false);
    expect(await keyMatches('', '')).toBe(false);
  });
});

describe('csv', () => {
  it('quotes and neutralises spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(cleanText('  a   b  ', 10)).toBe('a b');
  });
});
