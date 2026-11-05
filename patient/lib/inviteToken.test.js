import { describe, expect, it } from 'vitest';
import { readInviteToken } from './inviteToken';

describe('readInviteToken', () => {
  it('reads the token hash and type from the set-password route', () => {
    expect(readInviteToken('#/set-password?token_hash=abc123&type=recovery'))
      .toEqual({ tokenHash: 'abc123', type: 'recovery' });
  });

  it('defaults the type to recovery', () => {
    expect(readInviteToken('#/set-password?token_hash=abc')).toEqual({ tokenHash: 'abc', type: 'recovery' });
  });

  it('ignores other routes and links without a token', () => {
    expect(readInviteToken('#/home?token_hash=abc')).toBeNull();
    expect(readInviteToken('#/set-password')).toBeNull();
    expect(readInviteToken('')).toBeNull();
  });
});
