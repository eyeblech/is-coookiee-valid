/**
 * Generates dynamic, realistic sample presets relative to the current clock
 * so valid, expiring-soon, and expired cookies always behave consistently.
 */

function toBase64Url(obj) {
  const json = JSON.stringify(obj);
  const b64 = typeof btoa === 'function'
    ? btoa(json)
    : Buffer.from(json, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildSampleJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  return `${toBase64Url(header)}.${toBase64Url(payload)}.sig_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c`;
}

export function getSamplePresets(nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const in14DaysSec = nowSec + 14 * 86400;
  const in6HoursSec = nowSec + 6 * 3600;
  const ago3DaysSec = nowSec - 3 * 86400;
  const in30DaysSec = nowSec + 30 * 86400;

  const validJwt = buildSampleJwt({
    sub: 'usr_98234109',
    email: 'alex.dev@acme.io',
    role: 'admin',
    scope: ['read:projects', 'write:deploy'],
    iat: nowSec - 3600,
    exp: in14DaysSec,
  });

  const expiredJwt = buildSampleJwt({
    sub: 'usr_98234109',
    purpose: 'refresh_grant',
    iat: ago3DaysSec - 86400,
    exp: ago3DaysSec,
  });

  const jsonPreset = JSON.stringify(
    [
      {
        domain: '.acme.io',
        expirationDate: in14DaysSec,
        hostOnly: false,
        httpOnly: true,
        name: 'access_token',
        path: '/',
        sameSite: 'lax',
        secure: true,
        session: false,
        value: validJwt,
      },
      {
        domain: 'app.acme.io',
        expirationDate: in6HoursSec,
        hostOnly: true,
        httpOnly: true,
        name: '__Host-session_id',
        path: '/',
        sameSite: 'strict',
        secure: true,
        session: false,
        value: 's%3A8f9d2a7e1c4b6a0d3e5f.4kLmN9pQrStUvWxYz1234567890AbCdEfGhIjKlMnOp',
      },
      {
        domain: '.acme.io',
        expirationDate: ago3DaysSec,
        hostOnly: false,
        httpOnly: true,
        name: 'legacy_refresh_token',
        path: '/auth',
        sameSite: 'strict',
        secure: true,
        session: false,
        value: expiredJwt,
      },
      {
        domain: '.acme.io',
        expirationDate: in30DaysSec,
        hostOnly: false,
        httpOnly: false,
        name: 'XSRF-TOKEN',
        path: '/',
        sameSite: 'lax',
        secure: true,
        session: false,
        value: 'csrf_7890abcdef1234567890abcdef',
      },
      {
        domain: '.acme.io',
        hostOnly: false,
        httpOnly: false,
        name: 'ui_preferences',
        path: '/',
        sameSite: 'lax',
        secure: true,
        session: true,
        value: encodeURIComponent(JSON.stringify({ theme: 'dark', sidebar: 'expanded', locale: 'en-US' })),
      },
    ],
    null,
    2
  );

  const netscapePreset = [
    '# Netscape HTTP Cookie File',
    '# https://curl.se/docs/http-cookies.html',
    '# This file was exported for cookie validity inspection',
    '',
    `#HttpOnly_.github.com\tTRUE\t/\tTRUE\t${in14DaysSec}\tuser_session\tghs_98a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1`,
    `#HttpOnly_github.com\tFALSE\t/\tTRUE\t${in14DaysSec}\t__Host-user_session_same_site\tghs_98a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1`,
    `.github.com\tTRUE\t/\tTRUE\t${in30DaysSec}\tlogged_in\tyes`,
    `.github.com\tTRUE\t/\tTRUE\t${ago3DaysSec}\t_gh_sess_old\texpired_session_payload_89123`,
    `.github.com\tTRUE\t/\tTRUE\t0\ttz\tAsia%2FKathmandu`,
  ].join('\n');

  const setCookiePreset = [
    `Set-Cookie: __Host-auth_session=${validJwt}; Path=/; Expires=${new Date(in14DaysSec * 1000).toUTCString()}; Secure; HttpOnly; SameSite=Strict`,
    `Set-Cookie: cf_clearance=cf_99887766554433221100; Domain=.cloudflare-demo.com; Path=/; Max-Age=21600; Secure; HttpOnly; SameSite=Lax`,
    `Set-Cookie: tracking_opt_in=true; Domain=.cloudflare-demo.com; Path=/; Expires=${new Date(in30DaysSec * 1000).toUTCString()}; SameSite=None`,
    `Set-Cookie: __Host-misconfigured=12345; Domain=example.com; Path=/admin`,
    `Set-Cookie: expired_cart_id=cart_5512; Path=/; Expires=${new Date(ago3DaysSec * 1000).toUTCString()}; Secure; HttpOnly`,
  ].join('\n');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlPreset = [
    `curl '${origin}/api/mock-auth' \\`,
    `  -H 'Accept: application/json' \\`,
    `  -H 'Cookie: access_token=${validJwt}; session_active=true; theme=dark' \\`,
    `  -H 'User-Agent: CookiePulse-Inspector/1.0'`,
  ].join('\n');

  return [
    {
      id: 'json-mixed',
      name: 'Browser JSON Export (Valid + JWT + Expired)',
      badge: 'JSON',
      description: 'EditThisCookie / DevTools JSON with JWT payload, Express signed cookie, and expired token',
      content: jsonPreset,
      suggestedUrl: `${origin}/api/mock-auth`,
    },
    {
      id: 'netscape',
      name: 'Netscape cookies.txt',
      badge: 'cookies.txt',
      description: 'Standard 7-column Netscape cookie file used by curl, wget, and yt-dlp',
      content: netscapePreset,
      suggestedUrl: 'https://api.github.com/user',
    },
    {
      id: 'set-cookie-audit',
      name: 'Set-Cookie Headers & RFC Audit',
      badge: 'Set-Cookie',
      description: 'HTTP response headers demonstrating JWTs, SameSite=None, and __Host- prefix checks',
      content: setCookiePreset,
      suggestedUrl: `${origin}/api/mock-auth`,
    },
    {
      id: 'curl-live',
      name: 'cURL Command (Live Verification Demo)',
      badge: 'cURL',
      description: 'Paste a cURL command to auto-extract cookies, headers, and test against a live endpoint',
      content: curlPreset,
      suggestedUrl: `${origin}/api/mock-auth`,
    },
  ];
}
