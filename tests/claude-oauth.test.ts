import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing the module under test
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Import after mocking
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { readClaudeCredentials, refreshAnthropicToken, getAnthropicOAuthToken } from '../src/auth/claude-oauth.js';

describe('claude-oauth', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('readClaudeCredentials', () => {
    it('returns null when keychain fails and file does not exist', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = readClaudeCredentials();
      expect(result).toBeNull();
    });

    it('reads credentials from file when keychain fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        claudeAiOauth: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: Date.now() + 3600000,
        },
      }));

      const result = readClaudeCredentials();
      expect(result).not.toBeNull();
      expect(result?.access).toBe('test-access-token');
      expect(result?.refresh).toBe('test-refresh-token');
    });

    it('returns null for invalid credential format', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        claudeAiOauth: {
          // Missing required fields
          accessToken: 'test-access-token',
        },
      }));

      const result = readClaudeCredentials();
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not valid json');

      const result = readClaudeCredentials();
      expect(result).toBeNull();
    });
  });

  describe('refreshAnthropicToken', () => {
    it('refreshes token successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });
      global.fetch = mockFetch;

      const result = await refreshAnthropicToken('old-refresh-token');

      expect(result.access).toBe('new-access-token');
      expect(result.refresh).toBe('new-refresh-token');
      expect(result.type).toBe('oauth');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://console.anthropic.com/v1/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('old-refresh-token'),
        })
      );
    });

    it('throws on refresh failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      });
      global.fetch = mockFetch;

      await expect(refreshAnthropicToken('bad-token')).rejects.toThrow('OAuth refresh failed');
    });
  });

  describe('getAnthropicOAuthToken', () => {
    it('returns error when no credentials found', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await getAnthropicOAuthToken();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('No Claude Code credentials found');
      }
    });

    it('returns valid token when credentials are not expired', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        claudeAiOauth: {
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000, // 1 hour from now
        },
      }));

      const result = await getAnthropicOAuthToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.token).toBe('valid-token');
      }
    });

    it('refreshes expired token', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        claudeAiOauth: {
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() - 1000, // Already expired
        },
      }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });
      global.fetch = mockFetch;

      const result = await getAnthropicOAuthToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.token).toBe('refreshed-token');
      }
    });

    it('returns error when refresh fails', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('keychain error');
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        claudeAiOauth: {
          accessToken: 'expired-token',
          refreshToken: 'bad-refresh-token',
          expiresAt: Date.now() - 1000, // Already expired
        },
      }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      });
      global.fetch = mockFetch;

      const result = await getAnthropicOAuthToken();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('OAuth refresh failed');
      }
    });
  });
});
