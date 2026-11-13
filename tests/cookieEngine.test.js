import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUniversalCookies,
  inspectCookieValue,
  validateCookie,
  exportCookies,
} from '../src/utils/cookieEngine.js';
import { getSamplePresets } from '../src/utils/samplePresets.js';
import { createApp } from '../server/index.js';

const FIXED_NOW = 1794550000000; // Fixed reference timestamp in ms

test('Auto-detects and parses JSON Cookie Array with JWT and expired cookies', () => {
  const presets = getSamplePresets(FIXED_NOW);
  const jsonPreset = presets.find((p) => p.id === 'json-mixed');
  const result = parseUniversalCookies(jsonPreset.content, FIXED_NOW);

  assert.equal(result.detectedFormat, 'json');
  assert.equal(result.cookies.length, 5);
  assert.equal(result.summary.validCount, 3);
  assert.equal(result.summary.expiringSoonCount, 1);
  assert.equal(result.summary.expiredCount, 1);

  const jwtCookie = result.cookies.find((c) => c.name === 'access_token');
  assert.ok(jwtCookie);
  assert.equal(jwtCookie.status, 'valid');
  assert.equal(jwtCookie.category, 'auth');
  assert.equal(jwtCookie.valueInspection.encoding, 'jwt');
  assert.equal(jwtCookie.valueInspection.jwt.payload.email, 'alex.dev@acme.io');
});

test('Auto-detects and parses Netscape cookies.txt including #HttpOnly_ prefix', () => {
  const presets = getSamplePresets(FIXED_NOW);
  const netscapePreset = presets.find((p) => p.id === 'netscape');
  const result = parseUniversalCookies(netscapePreset.content, FIXED_NOW);

  assert.equal(result.detectedFormat, 'netscape');
  assert.equal(result.cookies.length, 5);

  const userSession = result.cookies.find((c) => c.name === 'user_session');
  assert.ok(userSession);
  assert.equal(userSession.httpOnly, true);
  assert.equal(userSession.secure, true);
  assert.equal(userSession.domain, '.github.com');
  assert.equal(userSession.isValid, true);

  const expiredSess = result.cookies.find((c) => c.name === '_gh_sess_old');
  assert.ok(expiredSess);
  assert.equal(expiredSess.status, 'expired');
  assert.equal(expiredSess.isValid, false);
});

test('Auto-detects Set-Cookie headers and flags RFC 6265 prefix & SameSite=None violations', () => {
  const presets = getSamplePresets(FIXED_NOW);
  const setCookiePreset = presets.find((p) => p.id === 'set-cookie-audit');
  const result = parseUniversalCookies(setCookiePreset.content, FIXED_NOW);

  assert.equal(result.detectedFormat, 'set-cookie');
  assert.equal(result.cookies.length, 5);

  const sameSiteInvalid = result.cookies.find((c) => c.name === 'tracking_opt_in');
  assert.equal(sameSiteInvalid.status, 'invalid');
  assert.ok(sameSiteInvalid.issues.some((i) => i.code === 'SAMESITE_NONE_INSECURE'));

  const hostMisconfigured = result.cookies.find((c) => c.name === '__Host-misconfigured');
  assert.equal(hostMisconfigured.status, 'invalid');
  assert.ok(hostMisconfigured.issues.some((i) => i.code === 'HOST_PREFIX_INSECURE'));
  assert.ok(hostMisconfigured.issues.some((i) => i.code === 'HOST_PREFIX_PATH'));
  assert.ok(hostMisconfigured.issues.some((i) => i.code === 'HOST_PREFIX_DOMAIN'));
});

test('Auto-detects cURL commands and extracts URL, cookies, and custom headers', () => {
  const presets = getSamplePresets(FIXED_NOW);
  const curlPreset = presets.find((p) => p.id === 'curl-live');
  const result = parseUniversalCookies(curlPreset.content, FIXED_NOW);

  assert.equal(result.detectedFormat, 'curl');
  assert.equal(result.cookies.length, 3);
  assert.ok(result.extractedUrl.endsWith('/api/mock-auth'));
  assert.equal(result.extractedHeaders['User-Agent'], 'CookiePulse-Inspector/1.0');
});

test('Exports only valid cookies across JSON, Netscape, and Header formats', () => {
  const presets = getSamplePresets(FIXED_NOW);
  const parsed = parseUniversalCookies(presets[0].content, FIXED_NOW);

  const validHeader = exportCookies(parsed.cookies, 'header', { onlyValid: true });
  assert.ok(validHeader.includes('access_token='));
  assert.ok(!validHeader.includes('legacy_refresh_token='));

  const netscapeOut = exportCookies(parsed.cookies, 'netscape', { onlyValid: true });
  assert.ok(netscapeOut.includes('# Netscape HTTP Cookie File'));
  assert.ok(!netscapeOut.includes('legacy_refresh_token'));
});

test('Live HTTP Verifier API & Mock Auth Sandbox work end-to-end', async () => {
  const app = await createApp({ isProd: true });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify with valid auth cookie
    const verifyValidRes = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: `${baseUrl}/api/mock-auth`,
        method: 'GET',
        cookies: [{ name: 'access_token', value: 'valid_token_123' }],
      }),
    });
    const validData = await verifyValidRes.json();
    assert.equal(validData.status, 200);
    assert.equal(validData.verdict, 'valid');
    assert.ok(validData.setCookies.length > 0);

    // 2. Verify without auth cookie (should return 401/403 rejected verdict)
    const verifyRejectedRes = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: `${baseUrl}/api/mock-auth`,
        method: 'GET',
        cookies: [],
      }),
    });
    const rejectedData = await verifyRejectedRes.json();
    assert.equal(rejectedData.status, 401);
    assert.equal(rejectedData.verdict, 'rejected');
  } finally {
    server.close();
  }
});
