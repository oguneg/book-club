import { describe, expect, it } from 'vitest';
import { formatInviteCode, normalizeInviteCode, roleAtLeast } from './clubs';

describe('invite codes', () => {
  it('accepts what people type, paste or click', () => {
    expect(normalizeInviteCode('ABCD-EFGH')).toBe('ABCDEFGH');
    expect(normalizeInviteCode(' abcd efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('https://bookclub.ogun.se/join/ABCD-EFGH')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('https://bookclub.ogun.se/join/ABCDEFGH/')).toBe('ABCDEFGH');
  });

  it('rejects look-alike characters and wrong lengths', () => {
    expect(normalizeInviteCode('ABCD-EFG0')).toBeNull();
    expect(normalizeInviteCode('ABCD-EFGI')).toBeNull();
    expect(normalizeInviteCode('ABCDEFG')).toBeNull();
    expect(normalizeInviteCode('')).toBeNull();
  });

  it('formats in two groups', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});

describe('roles', () => {
  it('ranks owner over admin over member', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
    expect(roleAtLeast('member', 'admin')).toBe(false);
    expect(roleAtLeast(null, 'member')).toBe(false);
  });
});
