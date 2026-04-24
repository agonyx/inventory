import { describe, test, expect } from 'bun:test';
import { formatCurrency, truncateString } from '../helpers';

describe('formatCurrency', () => {
  test('formats a positive amount with USD by default', () => {
    expect(formatCurrency(1234.5)).toBe('$1234.50');
  });

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  test('formats a negative amount with minus sign', () => {
    expect(formatCurrency(-42.99)).toBe('-$42.99');
  });

  test('rounds to two decimal places', () => {
    expect(formatCurrency(1.999)).toBe('$2.00');
  });

  test('supports EUR currency', () => {
    expect(formatCurrency(10, 'EUR')).toBe('€10.00');
  });

  test('supports GBP currency', () => {
    expect(formatCurrency(5.5, 'GBP')).toBe('£5.50');
  });

  test('falls back to currency code plus space for unknown currency', () => {
    expect(formatCurrency(100, 'CHF')).toBe('CHF 100.00');
  });
});

describe('truncateString', () => {
  test('returns the original string when length equals maxLength', () => {
    expect(truncateString('abc', 3)).toBe('abc');
  });

  test('returns the original string when length is less than maxLength', () => {
    expect(truncateString('hi', 10)).toBe('hi');
  });

  test('truncates and appends ellipsis when over maxLength', () => {
    expect(truncateString('hello world', 8)).toBe('hello w\u2026');
  });

  test('handles empty string', () => {
    expect(truncateString('', 5)).toBe('');
  });

  test('handles maxLength of 0 by slicing to -1 and appending ellipsis', () => {
    expect(truncateString('abc', 0)).toBe('ab\u2026');
  });

  test('handles maxLength of 1', () => {
    expect(truncateString('abc', 1)).toBe('\u2026');
  });

  test('handles single character string at maxLength 1', () => {
    expect(truncateString('a', 1)).toBe('a');
  });
});
