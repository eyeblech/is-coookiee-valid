import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export async function createApp({ isProd = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'CookiePulse Universal Cookie Checker API' });
  });

  // Built-in Mock Auth Endpoint so users can test live cookie verification immediately
  app.all('/api/mock-auth', (req, res) => {
    const rawCookieHeader = req.headers.cookie || '';
    const cookieMap = {};
    rawCookieHeader.split(';').forEach((pair) => {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        cookieMap[k] = v;
      }
    });

    const cookieNames = Object.keys(cookieMap);
    const hasAuthCookie = cookieNames.some((n) =>
      /^(access_token|__Host-session_id|__Host-auth_session|user_session|session_active|session|sid|token|jwt|auth)/i.test(n)
    );

    if (!rawCookieHeader || cookieNames.length === 0) {
      return res.status(401).json({
        authenticated: false,
        status: 'unauthenticated',
        message: 'No cookies were sent in the request.',
        receivedCookiesCount: 0,
      });
    }

    if (!hasAuthCookie) {
      return res.status(403).json({
        authenticated: false,
        status: 'missing_auth_cookie',
        message: 'Cookies were received, but no recognized authentication/session cookie was present.',
        receivedCookies: cookieNames,
      });
    }

    res.setHeader(
      'Set-Cookie',
      `last_verified_at=${new Date().toISOString()}; Path=/; HttpOnly; SameSite=Lax`
    );

    return res.status(200).json({
      authenticated: true,
      status: 'active_session',
      message: 'Session cookies verified! Authenticated session is active.',
      user: {
        id: 'usr_98234109',
        email: 'alex.dev@acme.io',
        role: 'admin',
      },
      receivedCookiesCount: cookieNames.length,
      receivedCookies: cookieNames,
      timestamp: new Date().toISOString(),
    });
  });

  // Live HTTP Cookie Verification Endpoint
  app.post('/api/verify', async (req, res) => {
    const {
      targetUrl,
      method = 'GET',
      cookies = [],
      customHeaders = {},
      followRedirects = true,
      successMatch = '',
      failureMatch = '',
      timeoutMs = 10000,
    } = req.body || {};

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid target URL.' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only http:// and https:// URLs are supported.' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format. Include http:// or https://.' });
    }

    const cookieHeaderString = Array.isArray(cookies)
      ? cookies
          .filter((c) => c && c.name)
          .map((c) => `${c.name}=${c.value ?? ''}`)
          .join('; ')
      : String(cookies || '');

    const requestHeaders = {
      'User-Agent':
        customHeaders['User-Agent'] ||
        customHeaders['user-agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        customHeaders['Accept'] ||
        customHeaders['accept'] ||
        'application/json, text/html, application/xhtml+xml, */*;q=0.8',
      ...customHeaders,
    };

    if (cookieHeaderString) {
      requestHeaders['Cookie'] = cookieHeaderString;
    }

    const startTime = Date.now();
    const redirectChain = [];
    const collectedSetCookies = [];
    let currentUrl = parsedUrl.toString();
    let currentMethod = String(method || 'GET').toUpperCase();
    let finalResponse = null;
    const maxHops = followRedirects ? 6 : 0;

    try {
      for (let hop = 0; hop <= maxHops; hop++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(Number(timeoutMs) || 10000, 25000));

        let response;
        try {
          response = await fetch(currentUrl, {
            method: currentMethod,
            headers: requestHeaders,
            redirect: 'manual',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        // Capture any Set-Cookie headers from this hop
        const hopSetCookies =
          typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : response.headers.get('set-cookie')
            ? [response.headers.get('set-cookie')]
            : [];

        for (const sc of hopSetCookies) {
          if (sc) collectedSetCookies.push(sc);
        }

        const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
        const locationHeader = response.headers.get('location');

        if (isRedirect && locationHeader && hop < maxHops) {
          const nextUrl = new URL(locationHeader, currentUrl).toString();
          redirectChain.push({
            hop: hop + 1,
            status: response.status,
            from: currentUrl,
            to: nextUrl,
          });
          currentUrl = nextUrl;
          if (response.status === 303 || (response.status === 302 && currentMethod === 'POST')) {
            currentMethod = 'GET';
          }
          continue;
        }

        finalResponse = response;
        break;
      }

      const durationMs = Date.now() - startTime;
      const bodyText = finalResponse ? await finalResponse.text() : '';
      const bodyPreview = bodyText.slice(0, 8000);

      const responseHeaders = {};
      if (finalResponse) {
        finalResponse.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
      }

      const status = finalResponse ? finalResponse.status : 0;
      const statusText = finalResponse ? finalResponse.statusText : '';

      // Evaluate login redirect or auth rejection heuristics
      const loginRedirectDetected =
        redirectChain.some((r) => /\/(login|signin|sign-in|auth|sso|session\/new|unauthorized)/i.test(r.to)) ||
        (!followRedirects &&
          [301, 302, 303, 307, 308].includes(status) &&
          /\/(login|signin|sign-in|auth|sso)/i.test(responseHeaders['location'] || ''));

      let customRuleResult = null;
      if (failureMatch && bodyText.toLowerCase().includes(String(failureMatch).toLowerCase())) {
        customRuleResult = 'failed_match';
      } else if (successMatch) {
        customRuleResult = bodyText.toLowerCase().includes(String(successMatch).toLowerCase())
          ? 'passed_match'
          : 'missing_success_match';
      }

      let verdict = 'valid'; // 'valid' | 'rejected' | 'redirected_to_login' | 'warning'
      let verdictTitle = 'Session Active / Valid Response';
      let verdictReason = `Server responded with HTTP ${status} ${statusText} in ${durationMs}ms.`;

      if (customRuleResult === 'failed_match') {
        verdict = 'rejected';
        verdictTitle = 'Rejected (Matched Failure Keyword)';
        verdictReason = `Response body matched failure rule "${failureMatch}".`;
      } else if (customRuleResult === 'missing_success_match') {
        verdict = 'rejected';
        verdictTitle = 'Rejected (Missing Expected Keyword)';
        verdictReason = `Response body did not contain expected keyword "${successMatch}".`;
      } else if (loginRedirectDetected) {
        verdict = 'redirected_to_login';
        verdictTitle = 'Session Expired / Redirected to Login';
        verdictReason = 'The endpoint redirected the request to a login or authentication page.';
      } else if (status === 401 || status === 403) {
        verdict = 'rejected';
        verdictTitle = `Unauthorized / Forbidden (HTTP ${status})`;
        verdictReason = 'The server rejected the cookies with an authentication or permission error.';
      } else if (status >= 200 && status < 300) {
        verdict = 'valid';
        verdictTitle = customRuleResult === 'passed_match'
          ? 'Session Valid (Matched Success Rule)'
          : `Session Valid (HTTP ${status})`;
        verdictReason = `Target endpoint accepted the request with HTTP ${status} in ${durationMs}ms.`;
      } else if (status >= 300 && status < 400) {
        verdict = 'warning';
        verdictTitle = `Redirect Response (HTTP ${status})`;
        verdictReason = `Endpoint returned redirect to ${responseHeaders['location'] || 'another location'}.`;
      } else {
        verdict = 'warning';
        verdictTitle = `HTTP ${status} ${statusText}`;
        verdictReason = `Server returned status code ${status}.`;
      }

      return res.json({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        durationMs,
        finalUrl: currentUrl,
        redirectChain,
        setCookies: collectedSetCookies,
        responseHeaders,
        bodyPreview,
        sentCookiesCount: Array.isArray(cookies) ? cookies.length : cookieHeaderString.split(';').filter(Boolean).length,
        sentCookieHeader: cookieHeaderString,
        verdict,
        verdictTitle,
        verdictReason,
      });
    } catch (err) {
      return res.status(502).json({
        error: err.name === 'AbortError'
          ? `Request timed out after ${timeoutMs}ms.`
          : `Failed to reach ${targetUrl}: ${err.message}`,
      });
    }
  });

  // Scan a live URL to discover Set-Cookie headers it returns
  app.post('/api/scan-url', async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a URL to scan.' });
    }

    let parsedUrl;
    try {
      const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      parsedUrl = new URL(normalized);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const collectedSetCookies = [];
    let currentUrl = parsedUrl.toString();
    const startTime = Date.now();

    try {
      for (let hop = 0; hop <= 4; hop++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
          response = await fetch(currentUrl, {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'manual',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        const hopCookies =
          typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : response.headers.get('set-cookie')
            ? [response.headers.get('set-cookie')]
            : [];

        const host = new URL(currentUrl).hostname;
        for (const sc of hopCookies) {
          if (sc) {
            // Attach default Domain if not present so parser knows which domain set it
            const hasDomain = /;\s*domain=/i.test(sc);
            collectedSetCookies.push(hasDomain ? `Set-Cookie: ${sc}` : `Set-Cookie: ${sc}; Domain=${host}`);
          }
        }

        const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
        const loc = response.headers.get('location');
        if (isRedirect && loc && hop < 4) {
          currentUrl = new URL(loc, currentUrl).toString();
          continue;
        }
        break;
      }

      return res.json({
        scannedUrl: currentUrl,
        durationMs: Date.now() - startTime,
        setCookieLines: collectedSetCookies,
        count: collectedSetCookies.length,
      });
    } catch (err) {
      return res.status(502).json({
        error: `Could not scan URL (${err.message}).`,
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start server if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT) || 3000;
  createApp().then((app) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`CookiePulse Server running at http://localhost:${port}`);
    });
  });
}
