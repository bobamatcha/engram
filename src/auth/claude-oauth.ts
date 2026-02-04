/**
 * Claude Code OAuth helper for engram summarize.
 * Reads credentials from macOS Keychain or ~/.claude/.credentials.json.
 * Used only for the summarize command; other commands don't need auth.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const CLAUDE_CREDS_PATH = '.claude/.credentials.json';

// OAuth refresh endpoint
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

export type ClaudeCredential = {
  type: 'oauth';
  access: string;
  refresh: string;
  expires: number;
};

/**
 * Read Claude Code credentials from macOS Keychain.
 */
function readFromKeychain(): ClaudeCredential | null {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const result = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`,
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const data = JSON.parse(result.trim());
    const oauth = data?.claudeAiOauth;
    if (!oauth || typeof oauth !== 'object') {
      return null;
    }

    const { accessToken, refreshToken, expiresAt } = oauth;
    if (typeof accessToken !== 'string' || !accessToken) return null;
    if (typeof refreshToken !== 'string' || !refreshToken) return null;
    if (typeof expiresAt !== 'number' || expiresAt <= 0) return null;

    return {
      type: 'oauth',
      access: accessToken,
      refresh: refreshToken,
      expires: expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Read Claude Code credentials from file.
 */
function readFromFile(): ClaudeCredential | null {
  const credPath = join(homedir(), CLAUDE_CREDS_PATH);
  if (!existsSync(credPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(credPath, 'utf8'));
    const oauth = raw?.claudeAiOauth;
    if (!oauth || typeof oauth !== 'object') {
      return null;
    }

    const { accessToken, refreshToken, expiresAt } = oauth;
    if (typeof accessToken !== 'string' || !accessToken) return null;
    if (typeof refreshToken !== 'string' || !refreshToken) return null;
    if (typeof expiresAt !== 'number' || expiresAt <= 0) return null;

    return {
      type: 'oauth',
      access: accessToken,
      refresh: refreshToken,
      expires: expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Read Claude Code credentials (Keychain first, then file fallback).
 */
export function readClaudeCredentials(): ClaudeCredential | null {
  return readFromKeychain() ?? readFromFile();
}

/**
 * Check if credential is valid (not expired, with 5-min buffer).
 */
function isValid(creds: ClaudeCredential): boolean {
  return creds.expires > Date.now() + 5 * 60 * 1000;
}

/**
 * Refresh Anthropic OAuth token using refresh token.
 * Returns new credentials or throws on failure.
 */
export async function refreshAnthropicToken(refreshToken: string): Promise<ClaudeCredential> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth refresh failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    type: 'oauth',
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000, // 5 min buffer
  };
}

export type OAuthResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Get a valid Anthropic OAuth token for API calls.
 * Reads credentials and refreshes if expired.
 */
export async function getAnthropicOAuthToken(): Promise<OAuthResult> {
  let creds = readClaudeCredentials();

  if (!creds) {
    const credFile = join(homedir(), CLAUDE_CREDS_PATH);
    return {
      ok: false,
      error:
        `No Claude Code credentials found. Checked:\n` +
        `  - macOS Keychain (service: "${KEYCHAIN_SERVICE}")\n` +
        `  - File: ${credFile}\n` +
        `Please open Claude Code and login to enable OAuth.`,
    };
  }

  // Refresh if expired
  if (!isValid(creds)) {
    try {
      creds = await refreshAnthropicToken(creds.refresh);
    } catch (err) {
      return {
        ok: false,
        error: `OAuth refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { ok: true, token: creds.access };
}
