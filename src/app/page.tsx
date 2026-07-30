'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/types';
import ProgressTracker from '@/components/ui/ProgressTracker';
import TrafficPanel from '@/components/modules/TrafficPanel';
import SEOPanel from '@/components/modules/SEOPanel';
import GEOPanel from '@/components/modules/GEOPanel';
import TechStackPanel from '@/components/modules/TechStackPanel';
import CompetitivePanel from '@/components/modules/CompetitivePanel';
import ScorecardPanel from '@/components/modules/ScorecardPanel';
import TokenUsagePanel from '@/components/ui/TokenUsagePanel';

type Tab = 'overview' | 'traffic' | 'seo' | 'geo' | 'techstack' | 'competitive';

export default function Dashboard() {
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const handleAnalyze = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.trim(),
          companyName: companyName.trim() || undefined,
          industry: industry.trim() || undefined,
          competitors: competitors.trim()
            ? competitors.split(',').map(c => c.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setActiveTab('overview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Scorecard' },
    { key: 'traffic', label: 'Traffic' },
    { key: 'seo', label: 'SEO' },
    { key: 'geo', label: 'GEO' },
    { key: 'techstack', label: 'Tech Stack' },
    { key: 'competitive', label: 'Competitive' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Top Bar */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--color-text)]">Digital Due Diligence</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Strategic Analysis Platform</p>
            </div>
          </div>
          {result && (
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
            >
              Export PDF
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Input Section */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Target Company Analysis</h2>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Domain *</label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="stripe.com"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Stripe"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="payments processing"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Competitors (comma-separated)</label>
              <input
                type="text"
                value={competitors}
                onChange={e => setCompetitors(e.target.value)}
                placeholder="square.com, paypal.com"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !domain.trim()}
            className="px-6 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Run Due Diligence'}
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="max-w-md mx-auto">
            <ProgressTracker progress={{
              traffic: 'running',
              seo: 'running',
              geo: 'running',
              techStack: 'running',
              competitive: 'pending',
              scorecard: 'pending',
            }} />
            <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
              Running comprehensive analysis — this may take 30-90 seconds...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Progress summary */}
            <div className="mb-6 flex items-center gap-4">
              <ProgressTracker progress={result.progress} />
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    activeTab === tab.key
                      ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'overview' && result.scorecard && (
                <ScorecardPanel data={result.scorecard} companyName={result.companyName} />
              )}
              {activeTab === 'traffic' && result.traffic && (
                <TrafficPanel data={result.traffic} />
              )}
              {activeTab === 'seo' && result.seo && (
                <SEOPanel data={result.seo} />
              )}
              {activeTab === 'geo' && result.geo && (
                <GEOPanel data={result.geo} />
              )}
              {activeTab === 'techstack' && result.techStack && (
                <TechStackPanel data={result.techStack} />
              )}
              {activeTab === 'competitive' && result.competitive && (
                <CompetitivePanel data={result.competitive} companyName={result.companyName} />
              )}

              {/* Token Usage - shown on all tabs when available */}
              {result.tokenUsage && (
                <TokenUsagePanel data={result.tokenUsage} />
              )}

              {/* Show "unavailable" message if module failed */}
              {activeTab !== 'overview' && !result[activeTab === 'techstack' ? 'techStack' : activeTab as keyof AnalysisResult] && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    This module encountered an error during analysis. Check API configuration and try again.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">Digital Due Diligence Platform</h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              Enter a target company domain above to run a comprehensive digital due diligence analysis
              covering traffic, SEO, GEO readiness, technical stack, and competitive positioning.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { title: 'Traffic Intelligence', desc: 'Source mix, geo distribution, engagement metrics' },
                { title: 'SEO & GEO Health', desc: 'Keyword authority, Core Web Vitals, AI readiness' },
                { title: 'Strategic Scorecard', desc: 'Composite score, risks, 100-day priorities' },
              ].map((item, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left">
                  <h3 className="text-sm font-medium text-[var(--color-text)] mb-1">{item.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
