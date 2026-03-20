import { APIConfig, CompetitiveData, CompetitorProfile, RAGStatus, ScoredMetric } from '@/types';
import { fetchWithTimeout, ragFromScore } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';

async function inferCompetitors(domain: string, companyName: string, industry: string, config: APIConfig): Promise<string[]> {
  // Try using an LLM to identify competitors
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
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `List the top 4 direct competitors of ${companyName} (${domain}) in the ${industry || 'technology'} space. Return ONLY a JSON array of domain names, e.g. ["competitor1.com","competitor2.com"]. No explanation.`,
          }],
        }),
      }, 20000);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) return JSON.parse(match[0]).slice(0, 4);
    } catch { /* fallback below */ }
  }
  return [];
}

async function profileCompetitor(domain: string, config: APIConfig): Promise<CompetitorProfile> {
  let domainAuthority: number | null = null;
  const techs: string[] = [];

  try {
    const res = await fetchWithTimeout(`https://${domain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DDBot/1.0)' },
    }, 10000);
    const html = await res.text();
    const htmlLower = html.toLowerCase();

    // Rough DA heuristic based on signals
    let daScore = 30;
    if (htmlLower.includes('schema.org')) daScore += 10;
    if (htmlLower.includes('hreflang')) daScore += 5;
    if (htmlLower.includes('gtag') || htmlLower.includes('google-analytics')) daScore += 5;
    if (html.length > 100_000) daScore += 10;
    domainAuthority = Math.min(daScore, 90);

    if (htmlLower.includes('react') || htmlLower.includes('__next')) techs.push('React');
    if (htmlLower.includes('shopify')) techs.push('Shopify');
    if (htmlLower.includes('wordpress') || htmlLower.includes('wp-content')) techs.push('WordPress');
  } catch { /* domain unreachable */ }

  const techTier: RAGStatus = (techs.length > 1 || domainAuthority !== null && domainAuthority > 50) ? 'green' : domainAuthority !== null && domainAuthority > 30 ? 'amber' : 'red';

  return {
    domain,
    name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
    trafficEstimate: null,
    domainAuthority,
    geoScore: null,
    techTier,
    paidSpendEstimate: null,
    shareOfVoice: { organic: 0, paid: 0, aiPresence: 0 },
  };
}

export async function analyzeCompetitive(
  domain: string,
  companyName: string,
  industry: string,
  competitors: string[],
  config: APIConfig
): Promise<CompetitiveData> {
  // Step 1: Identify competitors if not provided
  let competitorDomains = competitors.length > 0
    ? competitors
    : await inferCompetitors(domain, companyName, industry, config);

  if (competitorDomains.length === 0) {
    competitorDomains = []; // Will show empty state
  }

  // Step 2: Profile each competitor
  const profiles: CompetitorProfile[] = await Promise.all(
    competitorDomains.map(d => profileCompetitor(d, config))
  );

  // Step 3: Share of voice analysis via LLM
  if (hasKey(config, 'anthropicKey') && competitorDomains.length > 0) {
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
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `For the ${industry || 'technology'} market, estimate the relative share of voice (organic search visibility) for these companies on a 0-100 scale that sums to 100: ${companyName}, ${competitorDomains.join(', ')}. Return ONLY JSON: {"shares": {"company": number, ...}}`,
          }],
        }),
      }, 20000);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const shares = parsed.shares || parsed;
        for (const profile of profiles) {
          const key = Object.keys(shares).find(k =>
            k.toLowerCase().includes(profile.name.toLowerCase()) ||
            profile.name.toLowerCase().includes(k.toLowerCase())
          );
          if (key) {
            profile.shareOfVoice.organic = shares[key] / 100;
          }
        }
      }
    } catch { /* continue without share data */ }
  }

  // Step 4: Identify whitespace keywords
  const whitespaceKeywords: string[] = [];
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
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `What are 5 high-value search keywords/topics in the ${industry || 'technology'} space where ${companyName} might be underrepresented compared to competitors like ${competitorDomains.join(', ')}? Return ONLY a JSON array of strings.`,
          }],
        }),
      }, 20000);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) whitespaceKeywords.push(...JSON.parse(match[0]));
    } catch { /* continue */ }
  }

  // Build share of voice chart data
  const shareOfVoiceChart = [
    {
      company: companyName,
      organic: 0.3,
      paid: 0.2,
      ai: 0.25,
    },
    ...profiles.map(p => ({
      company: p.name,
      organic: p.shareOfVoice.organic || 0.15,
      paid: p.shareOfVoice.paid || 0.1,
      ai: p.shareOfVoice.aiPresence || 0.1,
    })),
  ];

  // Score
  const hasCompetitors = profiles.length > 0;
  const avgCompDA = profiles.reduce((s, p) => s + (p.domainAuthority || 0), 0) / Math.max(profiles.length, 1);
  const score = hasCompetitors ? Math.round(50 + (profiles.length * 5) + Math.min(avgCompDA / 3, 20)) : 40;

  const metrics: ScoredMetric[] = [
    {
      label: 'Competitors Identified',
      value: profiles.length,
      score: profiles.length >= 3 ? 80 : profiles.length >= 1 ? 50 : 20,
      status: ragFromScore(profiles.length >= 3 ? 80 : profiles.length >= 1 ? 50 : 20),
      source: hasKey(config, 'anthropicKey') ? 'Claude AI' : 'Manual input',
    },
    {
      label: 'Whitespace Opportunities',
      value: whitespaceKeywords.length,
      score: whitespaceKeywords.length > 0 ? 70 : 40,
      status: ragFromScore(whitespaceKeywords.length > 0 ? 70 : 40),
      source: 'LLM Analysis',
    },
  ];

  return {
    competitors: profiles,
    whitespaceKeywords,
    shareOfVoiceChart,
    score: Math.min(score, 100),
    metrics,
  };
}
