import React, { useState, useEffect } from 'react';
import {
  Play,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  Sparkles,
  DownloadCloud,
  Loader2,
  Radio,
} from 'lucide-react';

export default function LiveVerifierPanel({
  cookies,
  extractedUrl,
  extractedHeaders,
  onLoadSetCookies,
}) {
  const defaultSandboxUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mock-auth` : 'http://localhost:3000/api/mock-auth';

  const [targetUrl, setTargetUrl] = useState(extractedUrl || defaultSandboxUrl);
  const [method, setMethod] = useState('GET');
  const [onlyValid, setOnlyValid] = useState(true);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [successMatch, setSuccessMatch] = useState('');
  const [failureMatch, setFailureMatch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (extractedUrl) {
      setTargetUrl(extractedUrl);
    }
  }, [extractedUrl]);

  const cookiesToSend = onlyValid ? cookies.filter((c) => c.isValid) : cookies;

  const inferDomainUrl = () => {
    const firstDomain = cookies.find((c) => c.domain)?.domain?.replace(/^\./, '');
    if (firstDomain && !firstDomain.includes('acme.io') && !firstDomain.includes('cloudflare-demo.com')) {
      setTargetUrl(`https://${firstDomain}/`);
    } else {
      setTargetUrl(defaultSandboxUrl);
    }
  };

  const runLiveCheck = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          method,
          cookies: cookiesToSend.map((c) => ({ name: c.name, value: c.value })),
          customHeaders: extractedHeaders || {},
          followRedirects,
          successMatch: successMatch.trim(),
          failureMatch: failureMatch.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to verify cookies against target URL.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || 'Network error while contacting verification backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Configuration Card */}
      <div className="p-5 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[6px_6px_0px_#000000]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-black dark:text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#CCFF00]" />
              Live HTTP Probe & Session Verifier
            </h3>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Dispatches a server-side HTTP probe with your cookies to test endpoint authentication & inspect response headers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTargetUrl(defaultSandboxUrl)}
              className="brutal-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00F0FF] text-black border-2 border-black font-mono text-xs font-bold uppercase"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Local Sandbox
            </button>
            {cookies.some((c) => c.domain) && (
              <button
                type="button"
                onClick={inferDomainUrl}
                className="brutal-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F0EA] dark:bg-[#1E2231] text-black dark:text-white border-2 border-black dark:border-[#2A2E3D] font-mono text-xs font-bold uppercase"
              >
                <Globe className="w-3.5 h-3.5" />
                Target Cookie Host
              </button>
            )}
          </div>
        </div>

        <form onSubmit={runLiveCheck} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="px-3.5 py-2.5 border-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] font-mono text-xs font-bold text-black dark:text-[#CCFF00] focus:outline-none"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="HEAD">HEAD</option>
            </select>

            <div className="relative flex-1">
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.example.com/v1/me or http://localhost:3000/api/mock-auth"
                className="w-full px-3.5 py-2.5 border-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] font-mono text-sm text-black dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !targetUrl.trim()}
              className="brutal-btn inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#CCFF00] text-black border-2 border-black font-mono text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PROBING...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  FIRE PROBE ({cookiesToSend.length})
                </>
              )}
            </button>
          </div>

          {/* Options Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-5 text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyValid}
                  onChange={(e) => setOnlyValid(e.target.checked)}
                  className="accent-[#CCFF00] w-4 h-4"
                />
                <span>STRIP EXPIRED ({cookies.filter((c) => c.isValid).length}/{cookies.length} ACTIVE)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={(e) => setFollowRedirects(e.target.checked)}
                  className="accent-[#CCFF00] w-4 h-4"
                />
                <span>TRACE REDIRECT HOPS</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 font-bold uppercase text-black dark:text-[#00F0FF] hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvanced ? 'HIDE ASSERTIONS' : '+ BODY ASSERTIONS'}
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t-2 border-black dark:border-[#2A2E3D] font-mono">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Required Success Substring (Optional)
                </label>
                <input
                  type="text"
                  value={successMatch}
                  onChange={(e) => setSuccessMatch(e.target.value)}
                  placeholder='e.g. "authenticated":true'
                  className="w-full px-3 py-2 border-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] text-xs text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Failure / Rejection Substring (Optional)
                </label>
                <input
                  type="text"
                  value={failureMatch}
                  onChange={(e) => setFailureMatch(e.target.value)}
                  placeholder='e.g. "unauthenticated" or login'
                  className="w-full px-3 py-2 border-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] text-xs text-black dark:text-white"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 border-2 border-[#FF5E5B] bg-[#FF5E5B]/15 text-black dark:text-[#FF5E5B] font-mono text-xs font-bold flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Verification Result */}
      {result && (
        <div className="border-2 border-black dark:border-[#CCFF00] bg-white dark:bg-[#12141D] shadow-[6px_6px_0px_#000000]">
          {/* Verdict Banner */}
          <div
            className={`p-4 border-b-2 border-black flex flex-wrap items-center justify-between gap-4 font-mono ${
              result.verdict === 'valid'
                ? 'bg-[#CCFF00] text-black'
                : result.verdict === 'rejected' || result.verdict === 'redirected_to_login'
                ? 'bg-[#FF5E5B] text-black'
                : 'bg-[#FFB800] text-black'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.verdict === 'valid' ? (
                <CheckCircle2 className="w-6 h-6 shrink-0" />
              ) : result.verdict === 'rejected' || result.verdict === 'redirected_to_login' ? (
                <XCircle className="w-6 h-6 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold uppercase">{result.verdictTitle}</h4>
                <p className="text-xs opacity-90 mt-0.5">{result.verdictReason}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 bg-black text-white">
                HTTP {result.status} {result.statusText}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black text-[#CCFF00]">
                <Clock className="w-3.5 h-3.5" /> {result.durationMs}ms
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Redirect Chain if any */}
            {result.redirectChain && result.redirectChain.length > 0 && (
              <div>
                <div className="font-mono text-xs font-bold uppercase text-black dark:text-slate-300 mb-2">
                  Redirect Hop Trace ({result.redirectChain.length})
                </div>
                <div className="space-y-1.5">
                  {result.redirectChain.map((hop) => (
                    <div
                      key={hop.hop}
                      className="p-2 bg-[#090A0F] border-2 border-[#2A2E3D] text-xs font-mono flex items-center gap-2 overflow-x-auto text-white"
                    >
                      <span className="px-1.5 py-0.5 bg-[#FFB800] text-black font-bold">
                        {hop.status}
                      </span>
                      <span className="text-slate-400 truncate max-w-xs">{hop.from}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                      <span className="text-[#00F0FF] font-bold truncate">{hop.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Server Returned Set-Cookie Headers */}
            {result.setCookies && result.setCookies.length > 0 && (
              <div className="p-3.5 bg-[#090A0F] border-2 border-[#00F0FF]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold uppercase text-[#00F0FF]">
                    Server Emitted {result.setCookies.length} Set-Cookie Header{result.setCookies.length > 1 ? 's' : ''}
                  </span>
                  {onLoadSetCookies && (
                    <button
                      type="button"
                      onClick={() =>
                        onLoadSetCookies(
                          result.setCookies.map((sc) => `Set-Cookie: ${sc}`).join('\n')
                        )
                      }
                      className="brutal-btn inline-flex items-center gap-1.5 px-3 py-1 bg-[#00F0FF] text-black font-mono text-xs font-bold uppercase"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Load Into Matrix
                    </button>
                  )}
                </div>
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                  {result.setCookies.map((sc) => `Set-Cookie: ${sc}`).join('\n')}
                </pre>
              </div>
            )}

            {/* Response Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-xs font-bold uppercase text-black dark:text-slate-300 mb-1.5">
                  Response Payload
                </div>
                <pre className="p-3 bg-[#090A0F] text-[#CCFF00] font-mono text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-2 border-black dark:border-[#2A2E3D]">
                  {result.bodyPreview || '(EMPTY_BODY)'}
                </pre>
              </div>
              <div>
                <div className="font-mono text-xs font-bold uppercase text-black dark:text-slate-300 mb-1.5">
                  Response Headers
                </div>
                <pre className="p-3 bg-[#090A0F] text-slate-300 font-mono text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-2 border-black dark:border-[#2A2E3D]">
                  {Object.entries(result.responseHeaders || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n') || '(NO_HEADERS)'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
