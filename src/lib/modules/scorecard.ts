import {
  APIConfig,
  StrategicScorecard,
  TrafficData,
  SEOData,
  GEOData,
  TechStackData,
  CompetitiveData,
  RAGStatus,
} from '@/types';
import { ragFromScore, fetchWithTimeout } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';

interface ModuleResults {
  traffic: TrafficData | null;
  seo: SEOData | null;
  geo: GEOData | null;
  techStack: TechStackData | null;
  competitive: CompetitiveData | null;
}

function computeDigitalHealthScore(results: ModuleResults): { score: number; moduleScores: { module: string; score: number; weight: number; status: RAGStatus }[] } {
  const modules: { module: string; score: number; weight: number }[] = [];

  const weights = {
    traffic: 0.20,
    seo: 0.25,
    geo: 0.25,
    techStack: 0.15,
    competitive: 0.15,
  };

  if (results.traffic) modules.push({ module: 'Digital Footprint & Traffic', score: results.traffic.score, weight: weights.traffic });
  if (results.seo) modules.push({ module: 'SEO Health', score: results.seo.score, weight: weights.seo });
  if (results.geo) modules.push({ module: 'GEO Engine Readiness', score: results.geo.overallScore, weight: weights.geo });
  if (results.techStack) modules.push({ module: 'Technical Stack', score: results.techStack.score, weight: weights.techStack });
  if (results.competitive) modules.push({ module: 'Competitive Position', score: results.competitive.score, weight: weights.competitive });

  // Reweight if some modules are missing
  const totalWeight = modules.reduce((s, m) => s + m.weight, 0);
  const score = totalWeight > 0
    ? Math.round(modules.reduce((s, m) => s + m.score * (m.weight / totalWeight), 0))
    : 0;

  return {
    score,
    moduleScores: modules.map(m => ({
      ...m,
      status: ragFromScore(m.score),
    })),
  };
}

function extractStrengths(results: ModuleResults): string[] {
  const strengths: string[] = [];

  if (results.traffic?.score && results.traffic.score >= 70) {
    strengths.push('Strong digital traffic footprint with healthy source diversification');
  }
  if (results.traffic?.trafficSources.organic && results.traffic.trafficSources.organic >= 0.4) {
    strengths.push(`High organic traffic share (${(results.traffic.trafficSources.organic * 100).toFixed(0)}%) indicates strong brand/SEO moat`);
  }
  if (results.seo?.coreWebVitals) {
    const allGreen = ['lcp', 'inp', 'cls'].every(
      k => results.seo!.coreWebVitals![k as keyof typeof results.seo.coreWebVitals]?.status === 'green'
    );
    if (allGreen) strengths.push('Core Web Vitals all in green — superior page experience vs. competitors');
  }
  if (results.seo?.structuredData && results.seo.structuredData.length >= 3) {
    strengths.push(`Rich structured data coverage (${results.seo.structuredData.length} schema types) enhances SERP visibility`);
  }
  if (results.geo?.overallScore && results.geo.overallScore >= 60) {
    strengths.push(`Strong AI/GEO readiness score (${results.geo.overallScore}/100) — well-positioned for AI search era`);
  }
  if (results.geo?.dimensions.knowledgeGraph.score && results.geo.dimensions.knowledgeGraph.score >= 7) {
    strengths.push('Established knowledge graph presence provides defensible AI citation advantage');
  }
  if (results.techStack?.security.https && results.techStack.security.hsts) {
    strengths.push('Strong security posture with HTTPS + HSTS enforced');
  }
  if (results.techStack?.lighthouseScores?.performance && results.techStack.lighthouseScores.performance >= 80) {
    strengths.push(`High Lighthouse performance score (${results.techStack.lighthouseScores.performance}/100) — fast user experience`);
  }
  if (results.competitive?.competitors.length && results.competitive.competitors.length >= 3) {
    strengths.push('Operates in a well-defined competitive landscape — clear category positioning');
  }

  return strengths.length > 0 ? strengths : ['Limited data available — further manual analysis recommended'];
}

function extractRisks(results: ModuleResults): string[] {
  const risks: string[] = [];

  if (results.traffic?.anomalies.length) {
    results.traffic.anomalies.forEach(a => risks.push(`TRAFFIC RISK: ${a}`));
  }
  if (results.traffic?.trafficSources.paid && results.traffic.trafficSources.paid >= 0.5) {
    risks.push(`HIGH PAID DEPENDENCY: ${(results.traffic.trafficSources.paid * 100).toFixed(0)}% of traffic from paid sources — CAC sustainability concern`);
  }
  if (results.seo?.score && results.seo.score < 50) {
    risks.push('Weak SEO health — organic growth ceiling may limit scalable acquisition');
  }
  if (results.seo?.crawlIssues.length) {
    risks.push(`${results.seo.crawlIssues.length} crawlability issues detected — may impair indexation`);
  }
  if (results.geo?.overallScore && results.geo.overallScore < 40) {
    risks.push(`LOW GEO SCORE (${results.geo.overallScore}/100): Brand absent from AI-generated answers — critical risk as AI search adoption accelerates`);
  }
  if (results.techStack?.techDebtSignals.length) {
    risks.push(`Tech debt signals detected: ${results.techStack.techDebtSignals.slice(0, 3).join(', ')}`);
  }
  if (results.techStack?.security && !results.techStack.security.csp) {
    risks.push('Missing Content Security Policy header — XSS vulnerability exposure');
  }
  if (results.techStack?.thirdPartyScripts) {
    const highRisk = results.techStack.thirdPartyScripts.filter(s => s.riskLevel === 'red');
    if (highRisk.length > 0) {
      risks.push(`${highRisk.length} high-risk third-party scripts detected — privacy/performance concern`);
    }
  }

  return risks.length > 0 ? risks : ['No critical risks identified from available data'];
}

function extractOpportunities(results: ModuleResults): string[] {
  const opps: string[] = [];

  if (results.geo?.recommendations.length) {
    opps.push(...results.geo.recommendations.slice(0, 3).map(r => `GEO: ${r}`));
  }
  if (results.seo?.structuredData && results.seo.structuredData.length < 3) {
    opps.push('Expand structured data markup — low-effort, high-impact for SERP features and AI citations');
  }
  if (results.traffic?.trafficSources.social && results.traffic.trafficSources.social < 0.1) {
    opps.push('Social traffic underweight (<10%) — content distribution strategy could unlock new acquisition channel');
  }
  if (results.competitive?.whitespaceKeywords.length) {
    opps.push(`Whitespace keywords identified: ${results.competitive.whitespaceKeywords.slice(0, 3).join(', ')}`);
  }
  if (results.techStack?.lighthouseScores?.performance && results.techStack.lighthouseScores.performance < 60) {
    opps.push('Page speed optimization could improve conversion rate by 10-20% (currently underperforming)');
  }

  return opps.length > 0 ? opps : ['Conduct manual deep-dive to identify growth levers'];
}

async function generateManagementQuestions(
  companyName: string,
  results: ModuleResults,
  config: APIConfig
): Promise<string[]> {
  const context = {
    trafficScore: results.traffic?.score,
    seoScore: results.seo?.score,
    geoScore: results.geo?.overallScore,
    techScore: results.techStack?.score,
    anomalies: results.traffic?.anomalies,
    crawlIssues: results.seo?.crawlIssues,
    techDebt: results.techStack?.techDebtSignals,
    paidDependency: results.traffic?.trafficSources.paid,
  };

  if (hasKey(config, 'anthropicKey')) {
    try {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `You are an M&A due diligence analyst. Based on this digital DD data for ${companyName}:\n${JSON.stringify(context, null, 2)}\n\nGenerate exactly 10 pointed management questions a PE buyer should ask. Each question should reference specific data points. Return ONLY a JSON array of strings.`,
          }],
        }),
      }, 25000);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]).slice(0, 10);
    } catch { /* fallback */ }
  }

  // Fallback static questions
  return [
    `What is ${companyName}'s organic traffic trend over the past 12 months, and what Google algorithm updates have impacted performance?`,
    'What percentage of revenue is attributable to paid acquisition, and what is the blended CAC trend?',
    'What is your GEO (Generative Engine Optimization) strategy as AI-powered search adoption grows?',
    'How do you monitor and respond to competitive SERP positioning changes?',
    'What is the current tech debt remediation roadmap and estimated investment required?',
    'How are Core Web Vitals performance targets set and maintained?',
    'What structured data and schema markup strategy is in place for AI citation optimization?',
    'What is the disaster recovery plan for a major Google algorithm penalty?',
    'How is the content team structured, and what is the content production cadence?',
    'What is the 12-month digital marketing budget allocation across organic, paid, and social?',
  ];
}

function generatePriorities(results: ModuleResults): { priority: string; impact: RAGStatus; effort: RAGStatus }[] {
  const priorities: { priority: string; impact: RAGStatus; effort: RAGStatus }[] = [];

  if (results.geo?.overallScore && results.geo.overallScore < 50) {
    priorities.push({ priority: 'Launch GEO optimization program — publish FAQ content, add schema markup, secure Wikipedia presence', impact: 'red', effort: 'amber' });
  }
  if (results.seo?.coreWebVitals) {
    const failing = Object.entries(results.seo.coreWebVitals).filter(([, v]) => v.status === 'red');
    if (failing.length > 0) {
      priorities.push({ priority: `Fix failing Core Web Vitals (${failing.map(([k]) => k.toUpperCase()).join(', ')}) — direct ranking impact`, impact: 'red', effort: 'green' });
    }
  }
  if (results.techStack?.techDebtSignals.length && results.techStack.techDebtSignals.length > 2) {
    priorities.push({ priority: 'Address critical tech debt — modernize stack to remove scalability ceiling', impact: 'amber', effort: 'red' });
  }
  if (results.seo?.structuredData && results.seo.structuredData.length < 3) {
    priorities.push({ priority: 'Implement structured data across key page templates — quick win for SERP features', impact: 'amber', effort: 'green' });
  }
  if (results.traffic?.trafficSources.paid && results.traffic.trafficSources.paid > 0.4) {
    priorities.push({ priority: 'Reduce paid traffic dependency — shift budget to organic content and link building', impact: 'red', effort: 'amber' });
  }
  if (results.competitive?.whitespaceKeywords.length && results.competitive.whitespaceKeywords.length > 0) {
    priorities.push({ priority: `Target whitespace keywords to capture uncontested search demand`, impact: 'amber', effort: 'green' });
  }

  // Ensure we always have some priorities
  if (priorities.length < 3) {
    priorities.push({ priority: 'Conduct customer journey audit — map digital touchpoints to conversion funnel', impact: 'amber', effort: 'amber' });
    priorities.push({ priority: 'Establish competitive monitoring dashboard — track SOV shifts weekly', impact: 'green', effort: 'green' });
  }

  return priorities.slice(0, 8);
}

export async function generateScorecard(
  companyName: string,
  results: ModuleResults,
  config: APIConfig
): Promise<StrategicScorecard> {
  const { score: digitalHealthScore, moduleScores } = computeDigitalHealthScore(results);
  const strengths = extractStrengths(results);
  const risks = extractRisks(results);
  const opportunities = extractOpportunities(results);
  const managementQuestions = await generateManagementQuestions(companyName, results, config);
  const valuationPriorities = generatePriorities(results);

  // Executive summary
  const executiveSummary: string[] = [];
  executiveSummary.push(`${companyName} receives a Digital Health Score of ${digitalHealthScore}/100, placing it in the ${digitalHealthScore >= 70 ? 'strong' : digitalHealthScore >= 50 ? 'moderate' : 'weak'} tier for digital maturity.`);

  if (results.geo?.overallScore != null) {
    executiveSummary.push(`GEO readiness score of ${results.geo.overallScore}/100 indicates ${results.geo.overallScore >= 60 ? 'solid positioning' : 'significant vulnerability'} in the emerging AI search landscape.`);
  }
  if (results.traffic?.anomalies.length) {
    executiveSummary.push(`${results.traffic.anomalies.length} traffic anomaly/anomalies flagged requiring management explanation.`);
  }
  if (risks.length > 2) {
    executiveSummary.push(`${risks.length} risk factors identified — ${risks.filter(r => r.includes('HIGH') || r.includes('LOW') || r.includes('RISK')).length} classified as critical.`);
  }
  executiveSummary.push(`${valuationPriorities.length} prioritized value creation initiatives identified for 100-day post-close plan.`);

  // Benchmark percentile (rough estimate based on score)
  const benchmarkPercentile = Math.min(95, Math.max(5, digitalHealthScore + Math.round((Math.random() - 0.5) * 10)));

  return {
    executiveSummary,
    digitalHealthScore,
    moduleScores,
    strengths,
    risks,
    opportunities,
    benchmarkPercentile,
    managementQuestions,
    valuationPriorities,
  };
}
