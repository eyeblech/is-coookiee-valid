import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Shield,
  Clock,
  FileCode2,
  Trash2,
  Lock,
  Globe,
  Cpu,
} from 'lucide-react';

export default function CookieDetailPanel({ cookie, onDelete }) {
  const [copiedField, setCopiedField] = useState('');

  if (!cookie) {
    return (
      <div className="brutal-card-dark dark:brutal-card-dark bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 relative flex items-center justify-center">
          {/* Animated SVG Radar */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#CCFF00" strokeWidth="2" strokeDasharray="6 4" className="animate-spin-slow" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#00F0FF" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="50" y1="50" x2="50" y2="8" stroke="#CCFF00" strokeWidth="3" className="animate-radar" />
            <circle cx="50" cy="50" r="5" fill="#CCFF00" />
          </svg>
        </div>
        <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-black dark:text-white">
          Awaiting Specimen Selection
        </h3>
        <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-xs mx-auto">
          [SELECT ANY COOKIE SPECIMEN FROM THE MATRIX TO DECODE PAYLOADS, JWT CLAIMS & RFC-6265 TELEMETRY]
        </p>
      </div>
    );
  }

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 1800);
  };

  const { valueInspection, issues } = cookie;

  const statusMeta = {
    valid: {
      badge: 'bg-[#CCFF00] text-black border-black',
      label: 'ACTIVE // VALID',
      icon: CheckCircle2,
    },
    expiring_soon: {
      badge: 'bg-[#FFB800] text-black border-black',
      label: 'TTL WARNING (<24H)',
      icon: Clock,
    },
    expired: {
      badge: 'bg-[#FF5E5B] text-black border-black',
      label: 'EXPIRED // DEAD',
      icon: XCircle,
    },
    invalid: {
      badge: 'bg-[#FF5E5B] text-black border-black',
      label: 'RFC-6265 VIOLATION',
      icon: AlertTriangle,
    },
  }[cookie.status] || {
    badge: 'bg-slate-700 text-white border-black',
    label: cookie.status,
    icon: Cpu,
  };

  const StatusIcon = statusMeta.icon;

  return (
    <div className="bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#CCFF00] shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#CCFF00] overflow-hidden">
      {/* Top Specimen Header */}
      <div className="p-4 border-b-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#0D0F17] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase border-2 ${statusMeta.badge}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusMeta.label}
            </span>
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 bg-black text-[#00F0FF] border border-[#00F0FF]/50">
              ROLE:{cookie.category}
            </span>
            {valueInspection.encoding !== 'plain' && (
              <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 bg-[#00F0FF] text-black border border-black">
                {valueInspection.encoding}
              </span>
            )}
          </div>

          <h3 className="font-mono text-lg font-bold text-black dark:text-[#CCFF00] mt-2.5 break-all">
            {cookie.name || '(UNNAMED_COOKIE)'}
          </h3>
          <p className="font-mono text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-1">
            <Globe className="w-3.5 h-3.5 shrink-0 text-[#00F0FF]" />
            <span className="truncate">
              {cookie.domain || 'HOST-ONLY'} :: PATH={cookie.path}
            </span>
          </p>
        </div>

        {onDelete && (
          <button
            onClick={() => onDelete(cookie.id)}
            title="Purge cookie from matrix"
            className="brutal-btn p-2 bg-[#FF5E5B] text-black border-2 border-black font-mono text-xs font-bold shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 max-h-[680px] overflow-y-auto">
        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#F4F0EA] dark:bg-[#090A0F] border-2 border-black dark:border-[#2A2E3D]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#CCFF00]" /> TTL // LIFETIME
            </div>
            <div className="font-mono text-sm font-bold text-black dark:text-white mt-1">
              {cookie.remainingText}
            </div>
            <div className="font-mono text-[10px] text-slate-500 mt-0.5 truncate">
              {cookie.effectiveExpiresMs
                ? new Date(cookie.effectiveExpiresMs).toUTCString()
                : 'SESSION_EPHEMERAL'}
            </div>
          </div>

          <div className="p-3 bg-[#F4F0EA] dark:bg-[#090A0F] border-2 border-black dark:border-[#2A2E3D]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00F0FF]" /> PAYLOAD MASS
            </div>
            <div className="font-mono text-sm font-bold text-black dark:text-white mt-1">
              {valueInspection.byteSize}B{' '}
              <span className="text-xs font-normal text-slate-500">/ 4096B</span>
            </div>
            <div className="w-full h-2 bg-black/20 dark:bg-slate-800 mt-1.5 border border-black dark:border-slate-700">
              <div
                className={`h-full ${
                  valueInspection.byteSize > 4096
                    ? 'bg-[#FF5E5B]'
                    : valueInspection.byteSize > 3000
                    ? 'bg-[#FFB800]'
                    : 'bg-[#CCFF00]'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(4, (valueInspection.byteSize / 4096) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Security Matrix */}
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#CCFF00]" />
            Security Flag Matrix
          </div>
          <div className="grid grid-cols-4 gap-2 text-center font-mono">
            <div
              className={`p-2 border-2 text-xs font-bold ${
                cookie.secure
                  ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-black dark:text-[#CCFF00]'
                  : 'bg-slate-100 dark:bg-[#090A0F] border-slate-300 dark:border-[#2A2E3D] text-slate-400'
              }`}
            >
              <div className="text-[10px] uppercase">Secure</div>
              <div className="mt-0.5">{cookie.secure ? 'ON' : 'OFF'}</div>
            </div>
            <div
              className={`p-2 border-2 text-xs font-bold ${
                cookie.httpOnly
                  ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-black dark:text-[#00F0FF]'
                  : 'bg-slate-100 dark:bg-[#090A0F] border-slate-300 dark:border-[#2A2E3D] text-slate-400'
              }`}
            >
              <div className="text-[10px] uppercase">HttpOnly</div>
              <div className="mt-0.5">{cookie.httpOnly ? 'ON' : 'OFF'}</div>
            </div>
            <div className="p-2 border-2 bg-slate-100 dark:bg-[#090A0F] border-black dark:border-[#2A2E3D] text-black dark:text-white text-xs font-bold">
              <div className="text-[10px] uppercase text-slate-400">SameSite</div>
              <div className="mt-0.5">{cookie.sameSite}</div>
            </div>
            <div className="p-2 border-2 bg-slate-100 dark:bg-[#090A0F] border-black dark:border-[#2A2E3D] text-black dark:text-white text-xs font-bold">
              <div className="text-[10px] uppercase text-slate-400">Scope</div>
              <div className="mt-0.5">{cookie.hostOnly ? 'HOST' : 'WILDCARD'}</div>
            </div>
          </div>
        </div>

        {/* RFC Diagnostics */}
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-slate-300 mb-2">
            RFC-6265 Diagnostics ({issues.length === 0 ? 'ZERO ANOMALIES' : `${issues.length} ALERT${issues.length > 1 ? 'S' : ''}`})
          </div>
          {issues.length === 0 ? (
            <div className="p-3 bg-[#CCFF00]/15 border-2 border-[#CCFF00] text-black dark:text-[#CCFF00] font-mono text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>SPECIMEN PASSES ALL RFC-6265 SYNTAX, PREFIX, AND LIFETIME CHECKS.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 border-2 font-mono text-xs flex items-start gap-2 ${
                    issue.level === 'error'
                      ? 'bg-[#FF5E5B]/15 border-[#FF5E5B] text-black dark:text-[#FF5E5B]'
                      : 'bg-[#FFB800]/15 border-[#FFB800] text-black dark:text-[#FFB800]'
                  }`}
                >
                  {issue.level === 'error' ? (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold uppercase px-1.5 py-0.5 bg-black text-white mr-1.5 text-[10px]">
                      {issue.code}
                    </span>
                    <span>{issue.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Cookie Value */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold uppercase text-black dark:text-slate-300">
              Raw Byte Stream
            </span>
            <button
              onClick={() => copyText(cookie.value, 'raw')}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-black dark:text-[#CCFF00] hover:underline"
            >
              {copiedField === 'raw' ? (
                <>
                  <Check className="w-3.5 h-3.5" /> COPIED
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> COPY STREAM
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-[#090A0F] text-slate-200 font-mono text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto border-2 border-black dark:border-[#2A2E3D]">
            {cookie.value || '(EMPTY)'}
          </pre>
        </div>

        {/* Decoded Payload / JWT Inspector */}
        {(valueInspection.decodedText || valueInspection.frameworkHint) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-xs font-bold uppercase text-black dark:text-[#00F0FF] flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5" />
                Decompiled Payload // {valueInspection.frameworkHint || valueInspection.encoding}
              </span>
              {valueInspection.decodedText && (
                <button
                  onClick={() => copyText(valueInspection.decodedText, 'decoded')}
                  className="inline-flex items-center gap-1 font-mono text-xs font-bold text-black dark:text-[#00F0FF] hover:underline"
                >
                  {copiedField === 'decoded' ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> COPIED
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> COPY JSON
                    </>
                  )}
                </button>
              )}
            </div>

            {valueInspection.jwt && (
              <div className="mb-2 grid grid-cols-2 gap-2 font-mono text-xs">
                {valueInspection.innerIssuedAt && (
                  <div className="p-2 bg-[#090A0F] border-2 border-[#00F0FF]/50 text-[#00F0FF]">
                    <span className="opacity-75 block text-[10px] uppercase">JWT ISSUED (iat)</span>
                    <span className="font-bold">
                      {new Date(valueInspection.innerIssuedAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </span>
                  </div>
                )}
                {valueInspection.innerExpiresAt && (
                  <div
                    className={`p-2 border-2 ${
                      valueInspection.innerExpiresAt <= Date.now()
                        ? 'bg-[#090A0F] border-[#FF5E5B] text-[#FF5E5B]'
                        : 'bg-[#090A0F] border-[#CCFF00] text-[#CCFF00]'
                    }`}
                  >
                    <span className="opacity-75 block text-[10px] uppercase">JWT EXPIRES (exp)</span>
                    <span className="font-bold">
                      {new Date(valueInspection.innerExpiresAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {valueInspection.decodedText && (
              <pre className="p-3 bg-[#090A0F] text-[#CCFF00] font-mono text-xs whitespace-pre-wrap break-all max-h-60 overflow-y-auto border-2 border-[#00F0FF]">
                {valueInspection.decodedText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
