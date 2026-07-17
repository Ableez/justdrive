import { describe, it, expect } from 'vitest';
import { formatJson } from './json.js';

describe('output/json', () => {
  it('formats object as indented JSON', () => {
    const data = { name: 'test', value: 123 };
    const result = formatJson(data);
    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  it('formats array as indented JSON', () => {
    const data = [1, 2, 3];
    const result = formatJson(data);
    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  it('handles null', () => {
    const result = formatJson(null);
    expect(result).toBe('null');
  });

  it('handles nested objects', () => {
    const data = { a: { b: { c: 'deep' } } };
    const result = formatJson(data);
    expect(result).toContain('"c": "deep"');
  });

  it('handles empty object', () => {
    const result = formatJson({});
    expect(result).toBe('{}');
  });
});
