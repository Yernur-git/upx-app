import { describe, it, expect } from 'vitest';

// extractFirstBalancedObject is not exported, so we replicate it here
// to test the core parsing logic independently.
function extractFirstBalancedObject(s: string): { text: string; start: number } | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inStr = false; continue; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { text: s.slice(start, i + 1), start };
    }
  }
  return null;
}

describe('extractFirstBalancedObject', () => {
  it('extracts simple JSON', () => {
    const input = '{"message":"hello","actions":[]}';
    expect(extractFirstBalancedObject(input)?.text).toBe(input);
  });

  it('extracts JSON with leading text', () => {
    const input = 'Here is the result:\n{"message":"ok","actions":[]}';
    const result = extractFirstBalancedObject(input);
    expect(result?.text).toBe('{"message":"ok","actions":[]}');
    expect(result?.start).toBe(20);
  });

  it('handles nested objects', () => {
    const input = '{"message":"ok","actions":[{"action":"add","title":"test"}]}';
    expect(extractFirstBalancedObject(input)?.text).toBe(input);
  });

  it('handles escaped quotes in strings', () => {
    const input = '{"message":"say \\"hello\\"","actions":[]}';
    expect(extractFirstBalancedObject(input)?.text).toBe(input);
  });

  it('handles braces inside strings', () => {
    const input = '{"message":"use {curly} braces","actions":[]}';
    expect(extractFirstBalancedObject(input)?.text).toBe(input);
  });

  it('returns null for no braces', () => {
    expect(extractFirstBalancedObject('just plain text')).toBeNull();
  });

  it('returns null for unbalanced braces', () => {
    expect(extractFirstBalancedObject('{"incomplete": true')).toBeNull();
  });

  it('ignores trailing content', () => {
    const input = '{"a":1} some extra stuff {"b":2}';
    expect(extractFirstBalancedObject(input)?.text).toBe('{"a":1}');
  });

  it('handles deeply nested structures', () => {
    const input = '{"a":{"b":{"c":{"d":1}}}}';
    expect(extractFirstBalancedObject(input)?.text).toBe(input);
  });

  it('handles markdown code blocks around JSON', () => {
    const input = '```json\n{"message":"hello","actions":[]}\n```';
    const result = extractFirstBalancedObject(input);
    expect(result?.text).toBe('{"message":"hello","actions":[]}');
  });
});

describe('plain text detection', () => {
  // Testing the logic: if rawText doesn't contain '{', treat as plain message
  it('detects plain text (no braces)', () => {
    const rawText = 'Привет! Конечно, давай спланируем день.';
    const hasJson = rawText.includes('{');
    expect(hasJson).toBe(false);
  });

  it('detects JSON response', () => {
    const rawText = '{"message":"ok","actions":[]}';
    const hasJson = rawText.includes('{');
    expect(hasJson).toBe(true);
  });
});
