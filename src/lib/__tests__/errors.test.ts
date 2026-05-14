import { describe, it, expect } from 'vitest';
import { humanizeError } from '../errors';

describe('humanizeError', () => {
  // ── Auth errors ──────────────────────────────────────────────────
  it('handles invalid credentials', () => {
    expect(humanizeError(new Error('Invalid login credentials'), 'en'))
      .toBe('Wrong email or password.');
  });

  it('handles invalid credentials (ru)', () => {
    expect(humanizeError(new Error('Invalid login credentials'), 'ru'))
      .toBe('Неверный email или пароль.');
  });

  it('handles email not confirmed', () => {
    expect(humanizeError('email not confirmed', 'en'))
      .toContain('Confirm your email');
  });

  it('handles user already registered', () => {
    expect(humanizeError(new Error('User already registered'), 'en'))
      .toContain('already registered');
  });

  it('handles weak password', () => {
    expect(humanizeError(new Error('Password should be at least 8 chars'), 'en'))
      .toContain('too short');
  });

  it('handles rate limit', () => {
    expect(humanizeError(new Error('rate limit exceeded'), 'en'))
      .toContain('Too many attempts');
  });

  it('handles invalid email', () => {
    expect(humanizeError(new Error('invalid email format'), 'en'))
      .toContain('valid email');
  });

  it('handles session expired', () => {
    expect(humanizeError(new Error('jwt expired'), 'en'))
      .toContain('session expired');
  });

  // ── API / proxy errors ───────────────────────────────────────────
  it('handles AUTH_REQUIRED', () => {
    expect(humanizeError(new Error('AUTH_REQUIRED'), 'en'))
      .toContain('Sign in');
  });

  it('handles RATE_LIMITED', () => {
    expect(humanizeError(new Error('RATE_LIMITED'), 'en'))
      .toContain('rate limit');
  });

  it('handles PAYLOAD_TOO_LARGE', () => {
    expect(humanizeError(new Error('PAYLOAD_TOO_LARGE'), 'en'))
      .toContain('too long');
  });

  it('handles network errors', () => {
    expect(humanizeError(new Error('Failed to fetch'), 'en'))
      .toContain('Network');
  });

  it('handles timeout', () => {
    expect(humanizeError(new Error('request timed out'), 'en'))
      .toContain('too long');
  });

  it('handles 403', () => {
    expect(humanizeError(new Error('403 Forbidden'), 'en'))
      .toContain('permission');
  });

  // ── Fallback ─────────────────────────────────────────────────────
  it('falls back to raw message for unknown errors', () => {
    expect(humanizeError(new Error('something weird'), 'en'))
      .toBe('something weird');
  });

  it('truncates very long messages', () => {
    const long = 'a'.repeat(300);
    const result = humanizeError(new Error(long), 'en');
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toContain('…');
  });

  it('handles non-Error input', () => {
    expect(humanizeError('just a string', 'en')).toBe('just a string');
  });

  it('handles unknown types', () => {
    expect(humanizeError(42, 'en')).toBe('Unknown error');
  });
});
