// JCB-145: a deployed app talks to Supabase through its own address (/sb); local dev talks to it directly.
import { describe, expect, it } from 'vitest';
import { proxyUrl } from '../src/auth/proxy';

const at = (href: string) => {
  const u = new URL(href);
  return { origin: u.origin, protocol: u.protocol, hostname: u.hostname };
};

describe('proxyUrl', () => {
  it('uses the app\'s own https address plus /sb when deployed', () => {
    expect(proxyUrl(at('https://app.example.com/day/2026-10-15'))).toBe('https://app.example.com/sb');
    expect(proxyUrl(at('https://app-git-branch-team.vercel.app/'))).toBe('https://app-git-branch-team.vercel.app/sb');
  });

  it('goes straight to Supabase in local dev, on plain http, and with no location (tests)', () => {
    expect(proxyUrl(at('http://localhost:5173/'))).toBeNull();
    expect(proxyUrl(at('https://localhost:5173/'))).toBeNull();
    expect(proxyUrl(at('http://127.0.0.1:4173/'))).toBeNull();
    expect(proxyUrl(at('http://app.example.com/'))).toBeNull();
    expect(proxyUrl(undefined)).toBeNull();
  });
});
