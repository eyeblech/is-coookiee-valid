/**
 * Universal Cookie Parser, Decoder, Validator & Format Converter Engine
 * Supports: JSON (Browser Extensions, Puppeteer, HAR), Netscape cookies.txt,
 * HTTP Cookie / Set-Cookie headers, cURL commands, and raw key=value strings.
 */

// RFC 6265 token characters allowed in cookie-name
const RFC6265_NAME_REGEX = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const AUTH_COOKIE_PATTERNS = [
  /^(session|sess|sid|phpsessid|jsessionid|aspsessionid|connect\.sid|laravel_session|user_session)$/i,
  /(session_id|sessionid|sess_id|auth_token|authtoken|access_token|refresh_token|id_token|jwt|bearer|remember_token|remember_me|logged_in)/i,
  /^(__Host-.*session|__Secure-.*session|__Host-next-auth|next-auth\.session-token)/i,
  /^(c_user|xs|li_at|SID|HSID|SSID|APISID|SAPISID|__Secure-1PSID|__Secure-3PSID|auth_token|ct0|twid)$/i,
  /(token|auth|login|credential|sso)/i,
];

const SECURITY_COOKIE_PATTERNS = [
  /(csrf|xsrf|cf_clearance|__cf_bm|_cfuvid|ak_bmsc|bm_sz|datadome|recaptcha|turnstile)/i,
];

const ANALYTICS_COOKIE_PATTERNS = [
  /^(_ga|_gid|_gat|_gcl_|_fbp|_fbc|mp_|ajs_|_hj|_clck|_clsk|amplitude|plausible|umami)/i,
  /(analytics|telemetry|visitor_id|track)/i,
];

const PREFERENCE_COOKIE_PATTERNS = [
  /^(theme|dark_mode|lang|locale|timezone|tz|currency|consent|cookieconsent|optanonconsent|euconsent)/i,
];

/**
 * Base64 / Base64URL safe decoder
 */
export function tryDecodeBase64(str) {
  if (!str || typeof str !== 'string' || str.length < 4) return null;
  const cleaned = str.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;
  const padLen = (4 - (cleaned.length % 4)) % 4;
  const padded = cleaned + '='.repeat(padLen);
  try {
    let binary;
    if (typeof atob === 'function') {
      binary = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(padded, 'base64').toString('binary');
    } else {
      return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Ensure mostly printable ASCII/UTF-8
    const nonPrintable = decoded.split('').filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 9 || (code > 13 && code < 32) || code === 65533;
    }).length;
    if (nonPrintable > decoded.length * 0.1) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Inspect and decode a cookie's value (JWT, URL-encoded JSON, Base64 JSON, Laravel/Express signed cookies, epochs)
 */
export function inspectCookieValue(name, rawValue) {
  const value = String(rawValue ?? '');
  const result = {
    encoding: 'plain',
    decodedText: null,
    decodedJson: null,
    jwt: null,
    innerExpiresAt: null, // ms timestamp if inner token has exp
    innerIssuedAt: null,  // ms timestamp if inner token has iat
    frameworkHint: null,
    byteSize: new TextEncoder().encode(`${name}=${value}`).length,
  };

  if (!value) return result;

  // Strip surrounding quotes for inspection
  let unquoted = value;
  if (unquoted.length >= 2 && unquoted.startsWith('"') && unquoted.endsWith('"')) {
    unquoted = unquoted.slice(1, -1);
  }

  // Try URL decoding first if it contains %XX
  let urlDecoded = unquoted;
  if (/%[0-9A-Fa-f]{2}/.test(unquoted)) {
    try {
      urlDecoded = decodeURIComponent(unquoted);
      if (urlDecoded !== unquoted) {
        result.encoding = 'url-encoded';
        result.decodedText = urlDecoded;
      }
    } catch {
      // Keep original
    }
  }

  // 1. Check for Express signed cookie (s:...)
  if (urlDecoded.startsWith('s:')) {
    result.frameworkHint = 'Express / connect-redis Signed Cookie';
    const unsignedPart = urlDecoded.slice(2);
    const lastDot = unsignedPart.lastIndexOf('.');
    if (lastDot > 0) {
      result.decodedText = `Payload: ${unsignedPart.slice(0, lastDot)}\nHMAC Signature: ${unsignedPart.slice(lastDot + 1)}`;
    }
  }

  // 2. Check for JWT (header.payload.signature)
  const candidateJwt = urlDecoded.startsWith('Bearer ') ? urlDecoded.slice(7).trim() : urlDecoded;
  const jwtParts = candidateJwt.split('.');
  if (jwtParts.length === 3 && jwtParts[0].length >= 8 && jwtParts[1].length >= 8) {
    const headerStr = tryDecodeBase64(jwtParts[0]);
    const payloadStr = tryDecodeBase64(jwtParts[1]);
    if (headerStr && payloadStr) {
      try {
        const header = JSON.parse(headerStr);
        const payload = JSON.parse(payloadStr);
        if (header && typeof header === 'object' && payload && typeof payload === 'object') {
          result.encoding = 'jwt';
          result.frameworkHint = 'JSON Web Token (JWT)';
          result.jwt = {
            header,
            payload,
            signature: jwtParts[2],
          };
          result.decodedJson = payload;
          result.decodedText = JSON.stringify({ header, payload }, null, 2);

          if (typeof payload.exp === 'number') {
            result.innerExpiresAt = payload.exp < 1e12 ? payload.exp * 1000 : payload.exp;
          }
          if (typeof payload.iat === 'number') {
            result.innerIssuedAt = payload.iat < 1e12 ? payload.iat * 1000 : payload.iat;
          }
          return result;
        }
      } catch {
        // Not a valid JSON JWT
      }
    }
  }

  // 3. Check if URL-decoded value is direct JSON
  if (
    (urlDecoded.startsWith('{') && urlDecoded.endsWith('}')) ||
    (urlDecoded.startsWith('[') && urlDecoded.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(urlDecoded);
      result.encoding = result.encoding === 'url-encoded' ? 'url+json' : 'json';
      result.decodedJson = parsed;
      result.decodedText = JSON.stringify(parsed, null, 2);
      extractJsonExpiry(parsed, result);
      return result;
    } catch {
      // Not valid JSON
    }
  }

  // 4. Check if Base64 encoded JSON or text
  if (urlDecoded.length >= 12 && /^[A-Za-z0-9+/_=-]+$/.test(urlDecoded)) {
    const b64 = tryDecodeBase64(urlDecoded);
    if (b64 && b64.length >= 2) {
      try {
        const parsed = JSON.parse(b64);
        result.encoding = 'base64-json';
        result.decodedJson = parsed;
        result.decodedText = JSON.stringify(parsed, null, 2);
        if (parsed && parsed.iv && parsed.value && parsed.mac !== undefined) {
          result.frameworkHint = 'Laravel Encrypted Cookie (AES-256-CBC)';
        } else {
          extractJsonExpiry(parsed, result);
        }
        return result;
      } catch {
        if (b64.length >= 6 && /^[\x20-\x7E\s]+$/.test(b64)) {
          result.encoding = 'base64';
          result.decodedText = b64;
        }
      }
    }
  }

  // 5. Check if value is a direct Unix timestamp
  if (/^\d{10}$/.test(urlDecoded)) {
    const sec = Number(urlDecoded);
    if (sec > 946684800 && sec < 4102444800) {
      result.encoding = 'timestamp';
      result.decodedText = `Unix Epoch (s): ${new Date(sec * 1000).toUTCString()}`;
    }
  } else if (/^\d{13}$/.test(urlDecoded)) {
    const ms = Number(urlDecoded);
    if (ms > 946684800000 && ms < 4102444800000) {
      result.encoding = 'timestamp';
      result.decodedText = `Unix Epoch (ms): ${new Date(ms).toUTCString()}`;
    }
  }

  return result;
}

function extractJsonExpiry(obj, result) {
  if (!obj || typeof obj !== 'object') return;
  const expCandidate = obj.exp ?? obj.expires ?? obj.expiresAt ?? obj.expiration ?? obj.expiry;
  if (typeof expCandidate === 'number' && expCandidate > 0) {
    result.innerExpiresAt = expCandidate < 1e12 ? expCandidate * 1000 : expCandidate;
  } else if (typeof expCandidate === 'string') {
    const d = Date.parse(expCandidate);
    if (!Number.isNaN(d)) {
      result.innerExpiresAt = d;
    }
  }
}

/**
 * Classify cookie category (auth, security, analytics, preferences, general)
 */
export function classifyCookie(cookie) {
  const name = cookie.name || '';
  if ( cookie.valueInspection?.jwt ) {
    return 'auth';
  }
  for (const pat of SECURITY_COOKIE_PATTERNS) {
    if (pat.test(name)) return 'security';
  }
  for (const pat of AUTH_COOKIE_PATTERNS) {
    if (pat.test(name)) return 'auth';
  }
  for (const pat of ANALYTICS_COOKIE_PATTERNS) {
    if (pat.test(name)) return 'analytics';
  }
  for (const pat of PREFERENCE_COOKIE_PATTERNS) {
    if (pat.test(name)) return 'preferences';
  }
  return 'general';
}

/**
 * Normalize an expiration value into a millisecond timestamp (or null for session cookie)
 */
export function normalizeExpiresMs(cookie) {
  // If maxAge is explicitly provided
  if (cookie.maxAge !== undefined && cookie.maxAge !== null && cookie.maxAge !== '') {
    const maxAgeSec = Number(cookie.maxAge);
    if (!Number.isNaN(maxAgeSec)) {
      if (maxAgeSec <= 0) return 0; // Immediately expired
      const baseMs = cookie.parsedAtMs || Date.now();
      return baseMs + maxAgeSec * 1000;
    }
  }

  const rawExp = cookie.expires ?? cookie.expirationDate ?? cookie.expiry;
  if (rawExp === undefined || rawExp === null || rawExp === '' || rawExp === 'Session' || rawExp === -1) {
    return null; // Session cookie
  }

  if (typeof rawExp === 'number') {
    if (rawExp <= 0) return null; // 0 or -1 in Netscape / browser exports often means session
    return rawExp < 1e12 ? Math.round(rawExp * 1000) : Math.round(rawExp);
  }

  if (typeof rawExp === 'string') {
    const trimmed = rawExp.trim();
    if (!trimmed || trimmed.toLowerCase() === 'session' || trimmed === '0' || trimmed === '-1') {
      return null;
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (num <= 0) return null;
      return num < 1e12 ? Math.round(num * 1000) : Math.round(num);
    }
    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  return null;
}

/**
 * Validate a normalized cookie object against expiration, inner token expiry, and RFC 6265 security rules
 */
export function validateCookie(rawCookie, nowMs = Date.now()) {
  const name = String(rawCookie.name ?? '').trim();
  const value = String(rawCookie.value ?? '');
  const domain = String(rawCookie.domain ?? '').trim();
  const path = String(rawCookie.path || '/').trim();
  const secure = Boolean(rawCookie.secure);
  const httpOnly = Boolean(rawCookie.httpOnly);
  const hostOnly = rawCookie.hostOnly !== undefined ? Boolean(rawCookie.hostOnly) : !domain.startsWith('.');
  const sameSiteRaw = String(rawCookie.sameSite ?? '').trim().toLowerCase();

  let sameSite = 'Unspecified';
  if (sameSiteRaw === 'strict') sameSite = 'Strict';
  else if (sameSiteRaw === 'lax') sameSite = 'Lax';
  else if (sameSiteRaw === 'none' || sameSiteRaw === 'no_restriction') sameSite = 'None';

  const valueInspection = inspectCookieValue(name, value);
  const expiresMs = normalizeExpiresMs({ ...rawCookie, parsedAtMs: nowMs });
  const isSession = expiresMs === null;

  const issues = []; // { level: 'error' | 'warning' | 'info', code: string, message: string }

  // 1. Check syntax & RFC 6265 name rules
  let hasCriticalSyntaxError = false;
  if (!name) {
    hasCriticalSyntaxError = true;
    issues.push({
      level: 'error',
      code: 'EMPTY_NAME',
      message: 'Cookie name is empty.',
    });
  } else if (!RFC6265_NAME_REGEX.test(name)) {
    hasCriticalSyntaxError = true;
    issues.push({
      level: 'error',
      code: 'INVALID_NAME_CHARS',
      message: `Cookie name "${name}" contains characters disallowed by RFC 6265.`,
    });
  }

  // 2. Check byte size limit (4096 bytes per RFC 6265)
  if (valueInspection.byteSize > 4096) {
    hasCriticalSyntaxError = true;
    issues.push({
      level: 'error',
      code: 'SIZE_EXCEEDED',
      message: `Cookie size (${valueInspection.byteSize} bytes) exceeds the 4096-byte browser limit.`,
    });
  } else if (valueInspection.byteSize > 3500) {
    issues.push({
      level: 'warning',
      code: 'LARGE_COOKIE',
      message: `Cookie size (${valueInspection.byteSize} bytes) is close to the 4096-byte limit.`,
    });
  }

  // 3. Check __Host- and __Secure- prefix rules
  if (name.startsWith('__Host-')) {
    if (!secure) {
      hasCriticalSyntaxError = true;
      issues.push({
        level: 'error',
        code: 'HOST_PREFIX_INSECURE',
        message: '__Host- prefix requires the Secure attribute to be true.',
      });
    }
    if (path !== '/') {
      hasCriticalSyntaxError = true;
      issues.push({
        level: 'error',
        code: 'HOST_PREFIX_PATH',
        message: `__Host- prefix requires Path=/ (found "${path}").`,
      });
    }
    if (rawCookie.hasExplicitDomainAttribute) {
      hasCriticalSyntaxError = true;
      issues.push({
        level: 'error',
        code: 'HOST_PREFIX_DOMAIN',
        message: '__Host- prefix cookies must not specify a Domain attribute.',
      });
    }
  } else if (name.startsWith('__Secure-')) {
    if (!secure) {
      hasCriticalSyntaxError = true;
      issues.push({
        level: 'error',
        code: 'SECURE_PREFIX_INSECURE',
        message: '__Secure- prefix requires the Secure attribute to be true.',
      });
    }
  }

  // 4. Check SameSite=None requires Secure
  if (sameSite === 'None' && !secure) {
    hasCriticalSyntaxError = true;
    issues.push({
      level: 'error',
      code: 'SAMESITE_NONE_INSECURE',
      message: 'SameSite=None cookies without the Secure flag are rejected by modern browsers.',
    });
  }

  // 5. Check Expiration (Cookie attribute + Inner JWT/JSON expiry)
  let isExpired = false;
  let isExpiringSoon = false;
  const effectiveExpiresMs = expiresMs ?? valueInspection.innerExpiresAt ?? null;

  if (expiresMs !== null && expiresMs <= nowMs) {
    isExpired = true;
    issues.push({
      level: 'error',
      code: 'COOKIE_EXPIRED',
      message: expiresMs === 0
        ? 'Cookie has Max-Age <= 0 (immediately expired / deletion cookie).'
        : `Cookie expired ${formatRelativeTime(expiresMs, nowMs)} (${new Date(expiresMs).toUTCString()}).`,
    });
  }

  if (valueInspection.innerExpiresAt !== null) {
    if (valueInspection.innerExpiresAt <= nowMs) {
      isExpired = true;
      issues.push({
        level: 'error',
        code: 'TOKEN_EXPIRED',
        message: `Inner payload/JWT expired ${formatRelativeTime(valueInspection.innerExpiresAt, nowMs)} (${new Date(valueInspection.innerExpiresAt).toUTCString()}).`,
      });
    } else if (valueInspection.innerExpiresAt - nowMs <= 24 * 60 * 60 * 1000) {
      isExpiringSoon = true;
      issues.push({
        level: 'warning',
        code: 'TOKEN_EXPIRING_SOON',
        message: `Inner payload/JWT expires soon: ${formatRelativeTime(valueInspection.innerExpiresAt, nowMs)}.`,
      });
    }
  }

  if (!isExpired && expiresMs !== null && expiresMs - nowMs <= 24 * 60 * 60 * 1000) {
    isExpiringSoon = true;
    issues.push({
      level: 'warning',
      code: 'COOKIE_EXPIRING_SOON',
      message: `Cookie expires within 24 hours (${formatRelativeTime(expiresMs, nowMs)}).`,
    });
  }

  // Check empty value
  if (value === '') {
    issues.push({
      level: 'warning',
      code: 'EMPTY_VALUE',
      message: 'Cookie has an empty value (often used to clear a cookie).',
    });
  }

  const category = classifyCookie({ name, value, valueInspection });

  // 6. Security advisories for Auth/Session cookies
  if (category === 'auth' && !rawCookie.fromRequestHeaderOnly) {
    if (!httpOnly) {
      issues.push({
        level: 'warning',
        code: 'AUTH_MISSING_HTTPONLY',
        message: 'Authentication/session cookie does not have HttpOnly enabled (exposed to XSS via document.cookie).',
      });
    }
    if (!secure) {
      issues.push({
        level: 'warning',
        code: 'AUTH_MISSING_SECURE',
        message: 'Authentication/session cookie does not have Secure enabled (can be transmitted over plain HTTP).',
      });
    }
  }

  // Determine overall status
  let status = 'valid';
  if (hasCriticalSyntaxError) {
    status = 'invalid';
  } else if (isExpired) {
    status = 'expired';
  } else if (isExpiringSoon) {
    status = 'expiring_soon';
  }

  return {
    id: rawCookie.id || `${name}-${domain || 'local'}-${path}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    value,
    domain: domain || '',
    path: path || '/',
    expiresMs,
    effectiveExpiresMs,
    isSession,
    secure,
    httpOnly,
    hostOnly,
    sameSite,
    category,
    status, // 'valid' | 'expiring_soon' | 'expired' | 'invalid'
    isValid: status === 'valid' || status === 'expiring_soon',
    valueInspection,
    issues,
    fromRequestHeaderOnly: Boolean(rawCookie.fromRequestHeaderOnly),
    remainingText: effectiveExpiresMs
      ? formatRelativeTime(effectiveExpiresMs, nowMs)
      : 'Session (Browser Close)',
  };
}

/**
 * Format relative time difference cleanly (e.g., "in 14d 6h" or "3d 2h ago")
 */
export function formatRelativeTime(targetMs, nowMs = Date.now()) {
  const diffMs = targetMs - nowMs;
  const absSec = Math.round(Math.abs(diffMs) / 1000);

  if (absSec < 60) {
    return diffMs >= 0 ? `in ${absSec}s` : `${absSec}s ago`;
  }
  const mins = Math.floor(absSec / 60);
  if (mins < 60) {
    return diffMs >= 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return diffMs >= 0 ? `in ${hours}h ${remMins}m` : `${hours}h ${remMins}m ago`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days < 365) {
    return diffMs >= 0 ? `in ${days}d ${remHours}h` : `${days}d ${remHours}h ago`;
  }
  const years = (days / 365).toFixed(1);
  return diffMs >= 0 ? `in ${years}y` : `${years}y ago`;
}

/**
 * Parse a single Set-Cookie header line
 */
export function parseSetCookieLine(line, fallbackDomain = '') {
  const cleaned = line.replace(/^set-cookie:\s*/i, '').trim();
  if (!cleaned) return null;

  const parts = cleaned.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const firstEq = parts[0].indexOf('=');
  if (firstEq === -1) return null;

  const name = parts[0].slice(0, firstEq).trim();
  const value = parts[0].slice(firstEq + 1).trim();

  const cookie = {
    name,
    value,
    domain: fallbackDomain,
    path: '/',
    expires: null,
    maxAge: null,
    secure: false,
    httpOnly: false,
    sameSite: 'Unspecified',
    hasExplicitDomainAttribute: false,
    fromRequestHeaderOnly: false,
  };

  for (let i = 1; i < parts.length; i++) {
    const attr = parts[i];
    const eqIdx = attr.indexOf('=');
    const attrName = (eqIdx === -1 ? attr : attr.slice(0, eqIdx)).trim().toLowerCase();
    const attrVal = eqIdx === -1 ? '' : attr.slice(eqIdx + 1).trim();

    if (attrName === 'domain') {
      cookie.domain = attrVal;
      cookie.hasExplicitDomainAttribute = Boolean(attrVal);
    } else if (attrName === 'path') {
      cookie.path = attrVal || '/';
    } else if (attrName === 'expires') {
      cookie.expires = attrVal;
    } else if (attrName === 'max-age') {
      cookie.maxAge = attrVal;
    } else if (attrName === 'secure') {
      cookie.secure = true;
    } else if (attrName === 'httponly') {
      cookie.httpOnly = true;
    } else if (attrName === 'samesite') {
      cookie.sameSite = attrVal;
    }
  }

  return cookie;
}

/**
 * Parse cURL command to extract target URL, cookies, and extra headers
 */
export function parseCurlInput(input) {
  const trimmed = input.trim();
  const extractedHeaders = {};
  const cookieStrings = [];
  let targetUrl = '';

  // Normalize line continuations
  const singleLine = trimmed.replace(/\\\r?\n/g, ' ');

  // Match URL in curl command
  const urlMatch = singleLine.match(/https?:\/\/[^\s'"]+/i);
  if (urlMatch) {
    targetUrl = urlMatch[0];
  }

  let fallbackDomain = '';
  if (targetUrl) {
    try {
      fallbackDomain = new URL(targetUrl).hostname;
    } catch {
      // ignore
    }
  }

  // Extract -H / --header arguments
  const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/gi;
  let match;
  while ((match = headerRegex.exec(singleLine)) !== null) {
    const headerContent = match[2];
    const colonIdx = headerContent.indexOf(':');
    if (colonIdx !== -1) {
      const hName = headerContent.slice(0, colonIdx).trim();
      const hVal = headerContent.slice(colonIdx + 1).trim();
      if (hName.toLowerCase() === 'cookie') {
        cookieStrings.push(hVal);
      } else {
        extractedHeaders[hName] = hVal;
      }
    }
  }

  // Extract -b / --cookie arguments
  const cookieArgRegex = /(?:-b|--cookie)\s+(['"])(.*?)\1/gi;
  while ((match = cookieArgRegex.exec(singleLine)) !== null) {
    cookieStrings.push(match[2]);
  }

  const rawCookies = [];
  for (const cStr of cookieStrings) {
    const pairs = cStr.split(';').map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        rawCookies.push({
          name: pair.slice(0, eqIdx).trim(),
          value: pair.slice(eqIdx + 1).trim(),
          domain: fallbackDomain,
          path: '/',
          fromRequestHeaderOnly: true,
        });
      }
    }
  }

  return {
    rawCookies,
    targetUrl,
    extractedHeaders,
    fallbackDomain,
  };
}

/**
 * Universal Cookie Parser — Auto-detects format and returns normalized & validated cookies
 */
export function parseUniversalCookies(input, nowMs = Date.now()) {
  const text = String(input ?? '').trim();
  if (!text) {
    return {
      detectedFormat: 'empty',
      formatLabel: 'Waiting for input',
      cookies: [],
      extractedUrl: '',
      extractedHeaders: {},
      summary: computeSummary([]),
    };
  }

  let detectedFormat = 'unknown';
  let formatLabel = 'Raw Cookie String';
  let rawCookies = [];
  let extractedUrl = '';
  let extractedHeaders = {};

  // 1. Check if JSON (Array, Object, or HAR)
  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}'))
  ) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        detectedFormat = 'json';
        formatLabel = 'JSON Cookie Array (Browser / DevTools)';
        rawCookies = parsed.map(mapJsonCookie);
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.log && Array.isArray(parsed.log.entries)) {
          detectedFormat = 'har';
          formatLabel = 'HAR (HTTP Archive) Capture';
          rawCookies = extractCookiesFromHar(parsed);
        } else if (Array.isArray(parsed.cookies)) {
          detectedFormat = 'json';
          formatLabel = 'JSON Cookie Object';
          rawCookies = parsed.cookies.map(mapJsonCookie);
        } else if (parsed.name !== undefined && parsed.value !== undefined) {
          detectedFormat = 'json';
          formatLabel = 'Single JSON Cookie Object';
          rawCookies = [mapJsonCookie(parsed)];
        } else {
          // Key-value JSON dictionary
          detectedFormat = 'json-kv';
          formatLabel = 'JSON Key-Value Map';
          rawCookies = Object.entries(parsed).map(([k, v]) => ({
            name: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
            domain: '',
            path: '/',
            fromRequestHeaderOnly: true,
          }));
        }
      }
    } catch {
      // Fall through to text parsers
    }
  }

  // 2. Check if cURL command
  if (rawCookies.length === 0 && /^curl\s+/i.test(text)) {
    const curlResult = parseCurlInput(text);
    if (curlResult.rawCookies.length > 0) {
      detectedFormat = 'curl';
      formatLabel = 'cURL Command';
      rawCookies = curlResult.rawCookies;
      extractedUrl = curlResult.targetUrl;
      extractedHeaders = curlResult.extractedHeaders;
    }
  }

  // 3. Check if Netscape HTTP Cookie File format
  if (rawCookies.length === 0) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hasNetscapeHeader = lines.some((l) => /^#\s*(Netscape|HTTP Cookie File)/i.test(l));
    const netscapeLines = lines.filter((l) => {
      if (l.startsWith('#') && !/^#HttpOnly_/i.test(l)) return false;
      const cols = l.split(/\t|\s{2,}/);
      return cols.length >= 6 && /^(TRUE|FALSE)$/i.test(cols[1]) && /^(TRUE|FALSE)$/i.test(cols[3]);
    });

    if (hasNetscapeHeader || netscapeLines.length > 0) {
      detectedFormat = 'netscape';
      formatLabel = 'Netscape HTTP Cookie File (cookies.txt)';
      for (const line of netscapeLines) {
        let workLine = line;
        let httpOnly = false;
        if (/^#HttpOnly_/i.test(workLine)) {
          httpOnly = true;
          workLine = workLine.replace(/^#HttpOnly_/i, '');
        }
        const cols = workLine.split(/\t|\s{2,}/);
        if (cols.length >= 6) {
          const domain = cols[0];
          const includeSubdomains = cols[1].toUpperCase() === 'TRUE';
          const path = cols[2] || '/';
          const secure = cols[3].toUpperCase() === 'TRUE';
          const expiration = Number(cols[4]);
          const name = cols[5] || '';
          const value = cols.slice(6).join('\t') || '';
          rawCookies.push({
            name,
            value,
            domain,
            hostOnly: !includeSubdomains && !domain.startsWith('.'),
            path,
            secure,
            httpOnly,
            expires: Number.isNaN(expiration) ? null : expiration,
            fromRequestHeaderOnly: false,
          });
        }
      }
    }
  }

  // 4. Check if Set-Cookie headers or Cookie header / Key=Value pairs
  if (rawCookies.length === 0) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const isSetCookie = lines.some(
      (l) =>
        /^set-cookie:/i.test(l) ||
        /;\s*(path|domain|expires|max-age|secure|httponly|samesite)\b/i.test(l)
    );

    if (isSetCookie) {
      detectedFormat = 'set-cookie';
      formatLabel = 'HTTP Set-Cookie Response Header(s)';
      for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('//')) continue;
        const parsedCookie = parseSetCookieLine(line);
        if (parsedCookie) {
          rawCookies.push(parsedCookie);
        }
      }
    } else {
      // Parse as HTTP Cookie request header (`Cookie: a=1; b=2` or `a=1; b=2` or multiline `a=1`)
      detectedFormat = 'header';
      formatLabel = /^cookie:/i.test(text) ? 'HTTP Cookie Request Header' : 'Raw Key=Value / Header String';

      for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('//')) continue;
        const cleanedLine = line.replace(/^cookie:\s*/i, '').trim();
        const segments = cleanedLine.split(';').map((s) => s.trim()).filter(Boolean);
        for (const seg of segments) {
          const eqIdx = seg.indexOf('=');
          if (eqIdx > 0) {
            rawCookies.push({
              name: seg.slice(0, eqIdx).trim(),
              value: seg.slice(eqIdx + 1).trim(),
              domain: '',
              path: '/',
              fromRequestHeaderOnly: true,
            });
          } else if (seg) {
            rawCookies.push({
              name: seg,
              value: '',
              domain: '',
              path: '/',
              fromRequestHeaderOnly: true,
            });
          }
        }
      }
    }
  }

  const validatedCookies = rawCookies.map((c, idx) =>
    validateCookie({ ...c, id: `cookie-${idx}-${c.name || 'unnamed'}` }, nowMs)
  );

  return {
    detectedFormat,
    formatLabel,
    cookies: validatedCookies,
    extractedUrl,
    extractedHeaders,
    summary: computeSummary(validatedCookies),
  };
}

function mapJsonCookie(item) {
  if (!item || typeof item !== 'object') {
    return { name: '', value: String(item ?? '') };
  }
  const isSessionFlag = Boolean(item.session);
  const rawExp = isSessionFlag ? null : (item.expirationDate ?? item.expires ?? item.expiry ?? null);
  const domainStr = String(item.domain ?? item.host ?? '');
  const hasExplicitDomain =
    item.hostOnly === true
      ? false
      : item.hostOnly === false
      ? Boolean(domainStr)
      : domainStr.startsWith('.');
  return {
    name: item.name ?? item.key ?? '',
    value: item.value ?? '',
    domain: domainStr,
    path: item.path ?? '/',
    expires: rawExp,
    maxAge: item.maxAge ?? item['Max-Age'] ?? null,
    secure: Boolean(item.secure),
    httpOnly: Boolean(item.httpOnly),
    hostOnly: item.hostOnly !== undefined ? Boolean(item.hostOnly) : !domainStr.startsWith('.'),
    sameSite: item.sameSite ?? 'Unspecified',
    hasExplicitDomainAttribute: hasExplicitDomain,
    fromRequestHeaderOnly: false,
  };
}

function extractCookiesFromHar(har) {
  const seen = new Map();
  for (const entry of har.log.entries || []) {
    let fallbackDomain = '';
    try {
      if (entry.request?.url) {
        fallbackDomain = new URL(entry.request.url).hostname;
      }
    } catch {
      // ignore
    }
    const resCookies = entry.response?.cookies || [];
    const reqCookies = entry.request?.cookies || [];
    for (const c of [...resCookies, ...reqCookies]) {
      const mapped = mapJsonCookie({ ...c, domain: c.domain || fallbackDomain });
      const key = `${mapped.domain}|${mapped.path}|${mapped.name}`;
      seen.set(key, mapped);
    }
  }
  return Array.from(seen.values());
}

/**
 * Compute aggregate statistics and health score for a set of validated cookies
 */
export function computeSummary(cookies) {
  const total = cookies.length;
  const validCount = cookies.filter((c) => c.status === 'valid').length;
  const expiringSoonCount = cookies.filter((c) => c.status === 'expiring_soon').length;
  const expiredCount = cookies.filter((c) => c.status === 'expired').length;
  const invalidCount = cookies.filter((c) => c.status === 'invalid').length;

  const authCookies = cookies.filter((c) => c.category === 'auth');
  const validAuthCount = authCookies.filter((c) => c.isValid).length;
  const expiredAuthCount = authCookies.filter((c) => !c.isValid).length;

  const domains = Array.from(
    new Set(cookies.map((c) => c.domain.replace(/^\./, '')).filter(Boolean))
  );

  const totalBytes = cookies.reduce((acc, c) => acc + (c.valueInspection?.byteSize || 0), 0);

  // Determine overall session verdict
  let overallVerdict = 'empty';
  let overallLabel = 'No Cookies Loaded';
  if (total > 0) {
    if (expiredAuthCount > 0) {
      overallVerdict = 'expired_auth';
      overallLabel = 'Auth Session Expired';
    } else if (expiredCount === total || invalidCount === total) {
      overallVerdict = 'all_expired';
      overallLabel = 'All Cookies Expired / Invalid';
    } else if (expiredCount > 0 || invalidCount > 0) {
      overallVerdict = 'partial';
      overallLabel = `${validCount + expiringSoonCount}/${total} Valid (${expiredCount + invalidCount} Expired/Invalid)`;
    } else if (expiringSoonCount > 0) {
      overallVerdict = 'expiring_soon';
      overallLabel = 'Valid (Expiring Within 24h)';
    } else {
      overallVerdict = 'valid';
      overallLabel = authCookies.length > 0 ? 'All Cookies & Auth Tokens Valid' : 'All Cookies Valid';
    }
  }

  return {
    total,
    validCount,
    expiringSoonCount,
    usableCount: validCount + expiringSoonCount,
    expiredCount,
    invalidCount,
    authTotal: authCookies.length,
    validAuthCount,
    expiredAuthCount,
    domains,
    totalBytes,
    overallVerdict,
    overallLabel,
  };
}

/**
 * Export / serialize cookies into any standard format
 */
export function exportCookies(cookies, format = 'json', options = {}) {
  const list = options.onlyValid ? cookies.filter((c) => c.isValid) : cookies;
  const targetUrl = options.targetUrl || (list[0]?.domain ? `https://${list[0].domain.replace(/^\./, '')}/` : 'https://example.com/');

  switch (format) {
    case 'json': {
      const payload = list.map((c) => ({
        domain: c.domain || 'localhost',
        expirationDate: c.expiresMs ? Math.floor(c.expiresMs / 1000) : undefined,
        hostOnly: c.hostOnly,
        httpOnly: c.httpOnly,
        name: c.name,
        path: c.path || '/',
        sameSite: c.sameSite === 'Unspecified' ? 'unspecified' : c.sameSite.toLowerCase(),
        secure: c.secure,
        session: c.isSession,
        value: c.value,
      }));
      return JSON.stringify(payload, null, 2);
    }

    case 'netscape': {
      const header = [
        '# Netscape HTTP Cookie File',
        '# https://curl.se/docs/http-cookies.html',
        '# Generated by CookiePulse Universal Cookie Checker',
        '',
      ];
      const rows = list.map((c) => {
        const domain = c.domain || '.example.com';
        const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const path = c.path || '/';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expires = c.expiresMs ? Math.floor(c.expiresMs / 1000) : 0;
        const prefix = c.httpOnly ? '#HttpOnly_' : '';
        return `${prefix}${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expires}\t${c.name}\t${c.value}`;
      });
      return [...header, ...rows].join('\n');
    }

    case 'header': {
      return list.map((c) => `${c.name}=${c.value}`).join('; ');
    }

    case 'set-cookie': {
      return list
        .map((c) => {
          const parts = [`Set-Cookie: ${c.name}=${c.value}`];
          if (c.domain) parts.push(`Domain=${c.domain}`);
          if (c.path) parts.push(`Path=${c.path}`);
          if (c.expiresMs) parts.push(`Expires=${new Date(c.expiresMs).toUTCString()}`);
          if (c.secure) parts.push('Secure');
          if (c.httpOnly) parts.push('HttpOnly');
          if (c.sameSite && c.sameSite !== 'Unspecified') parts.push(`SameSite=${c.sameSite}`);
          return parts.join('; ');
        })
        .join('\n');
    }

    case 'curl': {
      const cookieHeader = list.map((c) => `${c.name}=${c.value}`).join('; ');
      return `curl -i '${targetUrl}' \\\n  -H 'Cookie: ${cookieHeader.replace(/'/g, "'\\''")}' \\\n  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'`;
    }

    case 'python': {
      const dict = {};
      for (const c of list) dict[c.name] = c.value;
      return `import requests\n\ncookies = ${JSON.stringify(dict, null, 4)}\n\nresponse = requests.get("${targetUrl}", cookies=cookies)\nprint(response.status_code, response.reason)`;
    }

    default:
      return '';
  }
}
