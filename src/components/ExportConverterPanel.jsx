import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileCode, Filter } from 'lucide-react';
import { exportCookies } from '../utils/cookieEngine.js';

const EXPORT_FORMATS = [
  { id: 'json', label: 'JSON ARRAY', ext: 'cookies.json', mime: 'application/json' },
  { id: 'netscape', label: 'NETSCAPE .TXT', ext: 'cookies.txt', mime: 'text/plain' },
  { id: 'header', label: 'COOKIE HEADER', ext: 'cookie-header.txt', mime: 'text/plain' },
  { id: 'set-cookie', label: 'SET-COOKIE', ext: 'set-cookies.txt', mime: 'text/plain' },
  { id: 'curl', label: 'CURL SNIPPET', ext: 'request.sh', mime: 'text/x-shellscript' },
  { id: 'python', label: 'PYTHON REQUESTS', ext: 'request.py', mime: 'text/x-python' },
];

export default function ExportConverterPanel({ cookies, extractedUrl }) {
  const [format, setFormat] = useState('json');
  const [onlyValid, setOnlyValid] = useState(true);
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    return exportCookies(cookies, format, { onlyValid, targetUrl: extractedUrl });
  }, [cookies, format, onlyValid, extractedUrl]);

  const activeFormatMeta = EXPORT_FORMATS.find((f) => f.id === format) || EXPORT_FORMATS[0];
  const exportedCount = onlyValid ? cookies.filter((c) => c.isValid).length : cookies.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: activeFormatMeta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFormatMeta.ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[6px_6px_0px_#000000] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-black dark:text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[#00F0FF]" />
            Transpiler & Clean Serializer
          </h3>
          <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Transpile between JSON, Netscape cookies.txt, HTTP headers, cURL, and Python while purging dead tokens.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#CCFF00] text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyValid}
            onChange={(e) => setOnlyValid(e.target.checked)}
            className="accent-black w-3.5 h-3.5"
          />
          <Filter className="w-3.5 h-3.5" />
          ONLY VALID ({exportedCount}/{cookies.length})
        </label>
      </div>

      {/* Format Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono">
        <div className="flex flex-wrap gap-1.5">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`brutal-btn px-3 py-1.5 text-xs font-bold uppercase border-2 ${
                format === f.id
                  ? 'bg-[#00F0FF] text-black border-black'
                  : 'bg-[#F4F0EA] dark:bg-[#090A0F] text-black dark:text-slate-300 border-black dark:border-[#2A2E3D]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!output}
            className="brutal-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F0EA] dark:bg-[#1E2231] text-black dark:text-white border-2 border-black dark:border-[#2A2E3D] text-xs font-bold uppercase"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#CCFF00]" />
                COPIED!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                COPY
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!output}
            className="brutal-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#CCFF00] text-black border-2 border-black text-xs font-bold uppercase"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT {activeFormatMeta.ext}
          </button>
        </div>
      </div>

      {/* Output Code Area */}
      <pre className="p-4 bg-[#090A0F] text-[#CCFF00] font-mono text-xs whitespace-pre-wrap break-all max-h-[420px] overflow-y-auto border-2 border-black dark:border-[#2A2E3D]">
        {output || '// NO_SPECIMENS_TO_EXPORT'}
      </pre>
    </div>
  );
}
