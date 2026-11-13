import React, { useState, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  Upload,
  ClipboardPaste,
  Trash2,
  Sparkles,
  Sun,
  Moon,
  Globe,
  Play,
  FileCode2,
  ListChecks,
  Filter,
  KeyRound,
  Loader2,
  Wand2,
  Terminal,
} from 'lucide-react';
import { parseUniversalCookies, exportCookies } from './utils/cookieEngine.js';
import { getSamplePresets } from './utils/samplePresets.js';
import CookieDetailPanel from './components/CookieDetailPanel.jsx';
import LiveVerifierPanel from './components/LiveVerifierPanel.jsx';
import ExportConverterPanel from './components/ExportConverterPanel.jsx';

export default function App() {
  const presets = useMemo(() => getSamplePresets(), []);
  const [darkMode, setDarkMode] = useState(true);
  const [rawInput, setRawInput] = useState(presets[0].content);
  const [activeTab, setActiveTab] = useState('inspector'); // 'inspector' | 'live' | 'export'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'valid' | 'expired' | 'auth' | 'warnings'
  const [domainFilter, setDomainFilter] = useState('all');
  const [selectedCookieId, setSelectedCookieId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Live URL Scanner state
  const [scanUrlInput, setScanUrlInput] = useState('');
  const [scanningUrl, setScanningUrl] = useState(false);
  const [scanError, setScanError] = useState('');

  const fileInputRef = useRef(null);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Parse current rawInput in real time
  const parsed = useMemo(() => parseUniversalCookies(rawInput), [rawInput]);
  const { cookies, summary, formatLabel, extractedUrl, extractedHeaders } = parsed;

  // Filtered cookies for the table
  const filteredCookies = useMemo(() => {
    return cookies.filter((c) => {
      if (domainFilter !== 'all') {
        const cleanDom = c.domain.replace(/^\./, '') || 'Host-only';
        if (cleanDom !== domainFilter) return false;
      }
      if (statusFilter === 'valid' && !c.isValid) return false;
      if (statusFilter === 'expired' && c.isValid) return false;
      if (statusFilter === 'auth' && c.category !== 'auth') return false;
      if (statusFilter === 'warnings' && c.issues.length === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchDomain = c.domain.toLowerCase().includes(q);
        const matchVal = c.value.toLowerCase().includes(q);
        const matchCat = c.category.toLowerCase().includes(q);
        return matchName || matchDomain || matchVal || matchCat;
      }
      return true;
    });
  }, [cookies, domainFilter, statusFilter, searchQuery]);

  // Currently selected cookie for deep inspection
  const selectedCookie = useMemo(() => {
    if (!cookies.length) return null;
    if (selectedCookieId) {
      const found = cookies.find((c) => c.id === selectedCookieId);
      if (found) return found;
    }
    return filteredCookies[0] || cookies[0] || null;
  }, [cookies, filteredCookies, selectedCookieId]);

  // Strip expired / invalid cookies and replace input with clean valid cookies
  const handleStripExpired = () => {
    const validOnly = cookies.filter((c) => c.isValid);
    const outFormat =
      parsed.detectedFormat === 'netscape'
        ? 'netscape'
        : parsed.detectedFormat === 'set-cookie'
        ? 'set-cookie'
        : parsed.detectedFormat === 'header'
        ? 'header'
        : 'json';
    const cleaned = exportCookies(validOnly, outFormat, { onlyValid: true });
    setRawInput(cleaned);
  };

  // Delete single cookie from input
  const handleDeleteCookie = (cookieId) => {
    const remaining = cookies.filter((c) => c.id !== cookieId);
    const outFormat =
      parsed.detectedFormat === 'netscape'
        ? 'netscape'
        : parsed.detectedFormat === 'set-cookie'
        ? 'set-cookie'
        : parsed.detectedFormat === 'header'
        ? 'header'
        : 'json';
    setRawInput(remaining.length ? exportCookies(remaining, outFormat, { onlyValid: false }) : '');
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawInput(text);
    } catch {
      // Clipboard permission denied or unavailable
    }
  };

  // Handle file upload
  const handleFileUpload = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawInput(String(e.target?.result || ''));
    };
    reader.readAsText(file);
  };

  // Scan a live URL for Set-Cookie headers
  const handleScanUrl = async (e) => {
    e.preventDefault();
    if (!scanUrlInput.trim()) return;
    setScanningUrl(true);
    setScanError('');
    try {
      const res = await fetch('/api/scan-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || 'Could not scan URL.');
      } else if (!data.setCookieLines || data.setCookieLines.length === 0) {
        setScanError(`Scanned ${data.scannedUrl}, but no Set-Cookie headers were returned on initial GET.`);
      } else {
        setRawInput(data.setCookieLines.join('\n'));
        setActiveTab('inspector');
        setScanUrlInput('');
      }
    } catch (err) {
      setScanError(err.message || 'Network error while scanning URL.');
    } finally {
      setScanningUrl(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#CCFF00] text-black border border-black">
            <CheckCircle2 className="w-3 h-3" /> VALID
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#FFB800] text-black border border-black">
            <Clock className="w-3 h-3" /> &lt;24H
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#FF5E5B] text-black border border-black">
            <XCircle className="w-3 h-3" /> EXPIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#FF5E5B] text-black border border-black">
            <AlertTriangle className="w-3 h-3" /> RFC ERR
          </span>
        );
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode
          ? 'bg-[#090A0F] text-[#F4F0EA] bg-blueprint'
          : 'bg-[#F4F0EA] text-[#111111] light-blueprint'
      }`}
    >
      {/* Top Telemetry Status Ribbon */}
      <div className="bg-[#CCFF00] text-black border-b-2 border-black font-mono text-[11px] font-bold py-1 px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            SYS.STATUS // ONLINE
          </span>
          <span>ENGINE: RFC-6265 + JWT DECOMPILER</span>
          <span className="hidden sm:inline">FORMATS: JSON • NETSCAPE • SET-COOKIE • HAR • CURL</span>
        </div>
        <div className="font-mono text-[11px]">
          PAYLOAD: {summary.totalBytes} BYTES // SPECIMENS: {summary.total}
        </div>
      </div>

      {/* Main Brutalist Header */}
      <header className="sticky top-0 z-30 bg-[#F4F0EA]/95 dark:bg-[#090A0F]/95 backdrop-blur-md border-b-2 border-black dark:border-[#2A2E3D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Animated Kinetic Cookie SVG Mascot */}
            <div className="w-12 h-12 bg-[#CCFF00] border-2 border-black shadow-[3px_3px_0px_#00F0FF] flex items-center justify-center shrink-0 animate-float">
              <svg viewBox="0 0 64 64" className="w-8 h-8">
                <circle cx="32" cy="32" r="26" fill="#090A0F" stroke="#000" strokeWidth="3" />
                <circle cx="22" cy="22" r="4" fill="#CCFF00" />
                <circle cx="40" cy="20" r="3" fill="#00F0FF" />
                <circle cx="26" cy="38" r="4.5" fill="#FF5E5B" />
                <circle cx="42" cy="36" r="3.5" fill="#CCFF00" />
                <circle cx="33" cy="28" r="2.5" fill="#FFF" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight uppercase text-black dark:text-white">
                  CRUMB<span className="text-[#00F0FF] dark:text-[#CCFF00]">LAB</span>
                </h1>
                <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-black text-[#CCFF00] border border-[#CCFF00]">
                  v2.4 STUDIO
                </span>
              </div>
              <p className="font-mono text-xs text-slate-600 dark:text-slate-400 hidden sm:block">
                Cookie Anatomy, JWT Decompiler &amp; RFC-6265 Telemetry Lab
              </p>
            </div>
          </div>

          {/* Live Website Cookie Header Scanner */}
          <form onSubmit={handleScanUrl} className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scanUrlInput}
                onChange={(e) => setScanUrlInput(e.target.value)}
                placeholder="Inspect URL Set-Cookie headers (e.g. github.com)..."
                className="w-full pl-9 pr-3 py-2 border-2 border-black dark:border-[#2A2E3D] bg-white dark:bg-[#12141D] font-mono text-xs text-black dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00]"
              />
            </div>
            <button
              type="submit"
              disabled={scanningUrl || !scanUrlInput.trim()}
              className="brutal-btn px-3.5 py-2 bg-[#00F0FF] text-black border-2 border-black font-mono text-xs font-bold uppercase disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
            >
              {scanningUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              SCAN HOST
            </button>
          </form>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title="Switch Studio Theme"
              className="brutal-btn px-3 py-2 border-2 border-black dark:border-[#CCFF00] bg-white dark:bg-[#12141D] text-black dark:text-[#CCFF00] font-mono text-xs font-bold uppercase flex items-center gap-1.5"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4" /> PAPER
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" /> OBSIDIAN
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {scanError && (
          <div className="p-3 bg-[#FFB800] text-black border-2 border-black font-mono text-xs font-bold flex items-center justify-between">
            <span>[SCAN_NOTICE]: {scanError}</span>
            <button onClick={() => setScanError('')} className="underline ml-4 uppercase">
              DISMISS
            </button>
          </div>
        )}

        {/* Top Workbench: Raw Specimen Input + Telemetry Readout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Universal Input Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`lg:col-span-7 p-4 bg-white dark:bg-[#12141D] border-2 transition-all flex flex-col justify-between shadow-[6px_6px_0px_#000000] ${
              isDragging
                ? 'border-[#CCFF00] bg-[#CCFF00]/10'
                : 'border-black dark:border-[#2A2E3D]'
            }`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-white flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-[#CCFF00]" />
                    Specimen Input Buffer
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold uppercase bg-black text-[#00F0FF] border border-[#00F0FF]">
                    <Sparkles className="w-3 h-3" />
                    {formatLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.har,.cookies"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="brutal-btn inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F0EA] dark:bg-[#1E2231] text-black dark:text-white border-2 border-black dark:border-[#2A2E3D] text-xs font-bold uppercase"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" /> PASTE
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="brutal-btn inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F0EA] dark:bg-[#1E2231] text-black dark:text-white border-2 border-black dark:border-[#2A2E3D] text-xs font-bold uppercase"
                  >
                    <Upload className="w-3.5 h-3.5" /> LOAD FILE
                  </button>
                  {(summary.expiredCount > 0 || summary.invalidCount > 0) && (
                    <button
                      type="button"
                      onClick={handleStripExpired}
                      className="brutal-btn inline-flex items-center gap-1 px-2.5 py-1 bg-[#CCFF00] text-black border-2 border-black text-xs font-bold uppercase"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> PURGE DEAD ({summary.expiredCount + summary.invalidCount})
                    </button>
                  )}
                  {rawInput && (
                    <button
                      type="button"
                      onClick={() => setRawInput('')}
                      className="brutal-btn p-1.5 bg-[#FF5E5B] text-black border-2 border-black text-xs font-bold"
                      title="Clear buffer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                rows={6}
                placeholder="// Paste JSON Cookie Array, Netscape cookies.txt, Set-Cookie headers, HAR JSON, or a cURL command..."
                className="w-full p-3 border-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] font-mono text-xs text-black dark:text-[#CCFF00] placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00] resize-y"
              />
            </div>

            {/* Sample Presets Footer */}
            <div className="pt-3 mt-2 border-t-2 border-black dark:border-[#2A2E3D] flex flex-wrap items-center gap-2 font-mono">
              <span className="text-[11px] font-bold uppercase text-slate-500">LOAD LAB PRESET:</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setRawInput(p.content);
                    setSelectedCookieId(null);
                  }}
                  className="brutal-btn px-2.5 py-1 text-xs font-bold uppercase bg-[#F4F0EA] dark:bg-[#090A0F] text-black dark:text-[#00F0FF] border-2 border-black dark:border-[#00F0FF]/50 hover:bg-[#00F0FF] hover:text-black"
                >
                  [{p.badge}]
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry Readout Cards */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5 content-between">
            {/* Overall Verdict Banner Card */}
            <div
              className={`col-span-2 p-4 border-2 border-black shadow-[5px_5px_0px_#000000] flex items-center justify-between gap-4 ${
                summary.overallVerdict === 'valid'
                  ? 'bg-[#CCFF00] text-black'
                  : summary.overallVerdict === 'expired_auth' || summary.overallVerdict === 'all_expired'
                  ? 'bg-[#FF5E5B] text-black'
                  : summary.overallVerdict === 'partial' || summary.overallVerdict === 'expiring_soon'
                  ? 'bg-[#FFB800] text-black'
                  : 'bg-white dark:bg-[#12141D] text-black dark:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {summary.overallVerdict === 'valid' ? (
                  <CheckCircle2 className="w-8 h-8 shrink-0" />
                ) : summary.overallVerdict === 'expired_auth' || summary.overallVerdict === 'all_expired' ? (
                  <XCircle className="w-8 h-8 shrink-0" />
                ) : (
                  <AlertTriangle className="w-8 h-8 shrink-0" />
                )}
                <div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-80">
                    DIAGNOSTIC VERDICT
                  </div>
                  <div className="font-display text-lg font-extrabold uppercase leading-tight mt-0.5">
                    {summary.overallLabel}
                  </div>
                </div>
              </div>

              {summary.total > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('live')}
                  className="brutal-btn px-3 py-2 bg-black text-[#CCFF00] border-2 border-black font-mono text-xs font-bold uppercase inline-flex items-center gap-1.5 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  PROBE LIVE
                </button>
              )}
            </div>

            {/* Valid Cookies Card */}
            <div className="p-4 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[5px_5px_0px_#000000]">
              <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                <span>ACTIVE SPECIMENS</span>
                <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
              </div>
              <div className="font-mono text-3xl font-bold text-black dark:text-[#CCFF00] mt-1">
                {summary.usableCount}
                <span className="text-sm font-normal text-slate-500">/{summary.total}</span>
              </div>
              <div className="font-mono text-[10px] uppercase text-slate-500 mt-1">
                {summary.expiringSoonCount > 0
                  ? `${summary.validCount} SOLID • ${summary.expiringSoonCount} EXPIRING`
                  : 'PASSING LIFETIME CHECKS'}
              </div>
            </div>

            {/* Expired / Invalid Card */}
            <div className="p-4 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[5px_5px_0px_#000000]">
              <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                <span>DEAD // CORRUPT</span>
                <XCircle className="w-4 h-4 text-[#FF5E5B]" />
              </div>
              <div className="font-mono text-3xl font-bold text-black dark:text-[#FF5E5B] mt-1">
                {summary.expiredCount + summary.invalidCount}
              </div>
              <div className="font-mono text-[10px] uppercase text-slate-500 mt-1">
                {summary.expiredCount} EXPIRED • {summary.invalidCount} RFC FAIL
              </div>
            </div>

            {/* Auth / Session Tokens Card */}
            <div className="p-4 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[5px_5px_0px_#000000]">
              <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                <span>AUTH // JWT TOKENS</span>
                <KeyRound className="w-4 h-4 text-[#00F0FF]" />
              </div>
              <div className="font-mono text-3xl font-bold text-black dark:text-[#00F0FF] mt-1">
                {summary.validAuthCount}
                <span className="text-sm font-normal text-slate-500">/{summary.authTotal}</span>
              </div>
              <div className="font-mono text-[10px] uppercase mt-1">
                {summary.expiredAuthCount > 0 ? (
                  <span className="text-[#FF5E5B] font-bold">{summary.expiredAuthCount} AUTH TOKEN DEAD</span>
                ) : summary.authTotal > 0 ? (
                  <span className="text-[#CCFF00]">AUTH TOKENS INTACT</span>
                ) : (
                  <span className="text-slate-500">NO AUTH TOKENS</span>
                )}
              </div>
            </div>

            {/* Domains & Payload Size Card */}
            <div className="p-4 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[5px_5px_0px_#000000]">
              <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                <span>HOST FOOTPRINT</span>
                <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
              </div>
              <div className="font-mono text-3xl font-bold text-black dark:text-white mt-1">
                {summary.domains.length || (summary.total > 0 ? 1 : 0)}{' '}
                <span className="text-xs font-normal text-slate-500 uppercase">HOSTS</span>
              </div>
              <div className="font-mono text-[10px] uppercase text-slate-500 mt-1 truncate">
                {summary.totalBytes} BYTES TOTAL
              </div>
            </div>
          </div>
        </section>

        {/* Mode Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black dark:border-[#2A2E3D] pb-4">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              className={`brutal-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border-2 ${
                activeTab === 'inspector'
                  ? 'bg-[#CCFF00] text-black border-black'
                  : 'bg-white dark:bg-[#12141D] text-black dark:text-white border-black dark:border-[#2A2E3D]'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              01 // SPECIMEN MATRIX ({cookies.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`brutal-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border-2 ${
                activeTab === 'live'
                  ? 'bg-[#CCFF00] text-black border-black'
                  : 'bg-white dark:bg-[#12141D] text-black dark:text-white border-black dark:border-[#2A2E3D]'
              }`}
            >
              <Play className="w-4 h-4" />
              02 // LIVE HTTP PROBE
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`brutal-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border-2 ${
                activeTab === 'export'
                  ? 'bg-[#CCFF00] text-black border-black'
                  : 'bg-white dark:bg-[#12141D] text-black dark:text-white border-black dark:border-[#2A2E3D]'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              03 // FORMAT TRANSPILER
            </button>
          </div>

          {activeTab === 'inspector' && (
            <div className="flex flex-wrap items-center gap-2 font-mono">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#12141D] p-1 border-2 border-black dark:border-[#2A2E3D] text-xs">
                {[
                  { id: 'all', label: `ALL (${cookies.length})` },
                  { id: 'valid', label: `VALID (${summary.usableCount})` },
                  { id: 'expired', label: `DEAD (${summary.expiredCount + summary.invalidCount})` },
                  { id: 'auth', label: `AUTH (${summary.authTotal})` },
                  { id: 'warnings', label: 'ALERTS' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                      statusFilter === tab.id
                        ? 'bg-[#00F0FF] text-black'
                        : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Domain Filter */}
              {summary.domains.length > 1 && (
                <select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="px-2.5 py-1.5 border-2 border-black dark:border-[#2A2E3D] bg-white dark:bg-[#12141D] text-xs font-bold uppercase text-black dark:text-white"
                >
                  <option value="all">ALL HOSTS ({summary.domains.length})</option>
                  {summary.domains.map((dom) => (
                    <option key={dom} value={dom}>
                      {dom}
                    </option>
                  ))}
                </select>
              )}

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH MATRIX..."
                  className="pl-8 pr-3 py-1.5 border-2 border-black dark:border-[#2A2E3D] bg-white dark:bg-[#12141D] text-xs text-black dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Cookie Inspector & Validity Table */}
        {activeTab === 'inspector' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Table Column */}
            <div className="lg:col-span-7 bg-white dark:bg-[#12141D] border-2 border-black dark:border-[#2A2E3D] shadow-[6px_6px_0px_#000000] overflow-hidden">
              {filteredCookies.length === 0 ? (
                <div className="p-12 text-center font-mono">
                  <Filter className="w-8 h-8 text-[#CCFF00] mx-auto mb-2" />
                  <h3 className="text-sm font-bold uppercase text-black dark:text-white">
                    {cookies.length === 0 ? 'MATRIX BUFFER EMPTY' : 'ZERO MATCHING SPECIMENS'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {cookies.length === 0
                      ? 'Paste cookie data above or click one of the Lab Presets.'
                      : 'Reset your search filter to view all loaded cookies.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono">
                    <thead>
                      <tr className="border-b-2 border-black dark:border-[#2A2E3D] bg-[#F4F0EA] dark:bg-[#090A0F] text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">STATE</th>
                        <th className="py-3 px-3">SPECIMEN // ROLE</th>
                        <th className="py-3 px-3">HOST</th>
                        <th className="py-3 px-3">TTL COUNTDOWN</th>
                        <th className="py-3 px-4 text-right">FLAGS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/10 dark:divide-[#2A2E3D] text-xs">
                      {filteredCookies.map((c) => {
                        const isSelected = selectedCookie && selectedCookie.id === c.id;
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCookieId(c.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#CCFF00]/20 dark:bg-[#CCFF00]/15'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              {getStatusBadge(c.status)}
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-bold text-black dark:text-white truncate max-w-[190px]">
                                {c.name || '(UNNAMED)'}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 font-bold uppercase border ${
                                    c.category === 'auth'
                                      ? 'bg-black text-[#CCFF00] border-[#CCFF00]'
                                      : c.category === 'security'
                                      ? 'bg-black text-[#00F0FF] border-[#00F0FF]'
                                      : 'bg-slate-200 dark:bg-[#090A0F] text-slate-600 dark:text-slate-400 border-transparent'
                                  }`}
                                >
                                  {c.category}
                                </span>
                                {c.valueInspection.encoding !== 'plain' && (
                                  <span className="text-[10px] px-1.5 py-0.2 font-bold uppercase bg-[#00F0FF] text-black">
                                    {c.valueInspection.encoding}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                              {c.domain || <span className="italic opacity-60">HOST-ONLY</span>}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <div
                                className={`font-bold ${
                                  c.status === 'expired'
                                    ? 'text-[#FF5E5B]'
                                    : c.status === 'expiring_soon'
                                    ? 'text-[#FFB800]'
                                    : 'text-black dark:text-[#CCFF00]'
                                }`}
                              >
                                {c.remainingText}
                              </div>
                              {c.effectiveExpiresMs && (
                                <div className="text-[10px] text-slate-500">
                                  {new Date(c.effectiveExpiresMs).toISOString().slice(0, 10)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {c.secure && (
                                  <span
                                    title="Secure flag enabled"
                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-[#CCFF00]/20 text-black dark:text-[#CCFF00] border border-[#CCFF00]"
                                  >
                                    SEC
                                  </span>
                                )}
                                {c.httpOnly && (
                                  <span
                                    title="HttpOnly flag enabled"
                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-[#00F0FF]/20 text-black dark:text-[#00F0FF] border border-[#00F0FF]"
                                  >
                                    HTTP
                                  </span>
                                )}
                                {c.issues.length > 0 && (
                                  <span
                                    title={`${c.issues.length} audit finding(s)`}
                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FFB800] text-black"
                                  >
                                    !{c.issues.length}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Deep Cookie Inspector Column */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <CookieDetailPanel
                cookie={selectedCookie}
                onDelete={handleDeleteCookie}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Live HTTP Endpoint Verifier */}
        {activeTab === 'live' && (
          <LiveVerifierPanel
            cookies={cookies}
            extractedUrl={extractedUrl}
            extractedHeaders={extractedHeaders}
            onLoadSetCookies={(setCookieText) => {
              setRawInput(setCookieText);
              setActiveTab('inspector');
            }}
          />
        )}

        {/* Tab 3: Universal Format Converter & Exporter */}
        {activeTab === 'export' && (
          <ExportConverterPanel
            cookies={cookies}
            extractedUrl={extractedUrl}
          />
        )}
      </main>
    </div>
  );
}
