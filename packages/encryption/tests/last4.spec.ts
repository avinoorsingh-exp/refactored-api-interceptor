import { extractLastFour } from '../src/utils/last4.js';

describe('extractLastFour', () => {
  it('should extract last 4 digits from an SSN', () => {
    expect(extractLastFour('123-45-6789')).toBe('6789');
  });

  it('should extract last 4 digits from an EIN', () => {
    expect(extractLastFour('12-3456789')).toBe('6789');
  });

  it('should extract last 4 digits from an ITIN', () => {
    expect(extractLastFour('912-34-5678')).toBe('5678');
  });

  it('should extract last 4 digits from a bank account number', () => {
    expect(extractLastFour('0012345678')).toBe('5678');
  });

  it('should handle short account numbers with leading zeros', () => {
    expect(extractLastFour('00004521')).toBe('4521');
  });

  it('should handle values with spaces', () => {
    expect(extractLastFour('123 45 6789')).toBe('6789');
  });

  it('should handle alphanumeric values', () => {
    expect(extractLastFour('AB-12CD-5678')).toBe('5678');
  });

  it('should return the full stripped value if shorter than 4 chars', () => {
    expect(extractLastFour('1-2-3')).toBe('123');
  });

  it('should handle exactly 4 alphanumeric characters', () => {
    expect(extractLastFour('AB12')).toBe('AB12');
  });

  it('should throw on empty string', () => {
    expect(() => extractLastFour('')).toThrow(
      'Cannot extract last four',
    );
  });

  it('should throw on string with only non-alphanumeric characters', () => {
    expect(() => extractLastFour('---')).toThrow(
      'Cannot extract last four',
    );
  });
});