import * as cheerio from 'cheerio';
import { APIConfig, TrafficData, ScoredMetric } from '@/types';
import { ragFromScore, fetchWithTimeout, clamp } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';

// ─── SimilarWeb API ───────────────────────────────────────────────────────────

async function fetchSimilarWeb(domain: string, config: APIConfig): Promise<TrafficData | null> {
  try {
    const base = 'https://api.similarweb.com/v1/website';
    const key = config.similarwebKey;

    const [overviewRes, trafficRes] = await Promise.all([
      fetchWithTimeout(
        `${base}/${domain}/total-traffic-and-engagement/visits?api_key=${key}&start_date=${prevMonth()}&end_date=${currentMonth()}&granularity=monthly&main_domain_only=false&format=json`,
        {},
        20000
      ),
      fetchWithTimeout(
        `${base}/${domain}/traffic-sources/overview-share?api_key=${key}&start_date=${prevMonth()}&end_date=${currentMonth()}&granularity=monthly&main_domain_only=false&format=json`,
        {},
        20000
      ),
    ]);

    if (!overviewRes.ok || !trafficRes.ok) return null;

    const overview = await overviewRes.json();
    const trafficSrc = await trafficRes.json();

    const visits: number = overview?.visits?.[0]?.visits ?? null;
    if (!visits) return null;

    const sources = trafficSrc?.overview?.[0]?.sources ?? [];
    const findShare = (type: string): number => {
      const s = sources.find((x: { source_type: string; share: number }) => x.source_type === type);
      return s ? Math.round(s.share * 100) : 0;
    };

    const organic = findShare('Organic Search');
    const paid = findShare('Paid Search');
    const direct = findShare('Direct');
    const referral = findShare('Referrals');
    const social = findShare('Social');

    // Normalise to sum = 100
    const total = organic + paid + direct + referral + social || 100;
    const norm = (n: number) => Math.round((n / total) * 100);

    const trafficSources = {
      organic: norm(organic),
      paid: norm(paid),
      direct: norm(direct),
      referral: norm(referral),
      social: norm(social),
    };

    const anomalies = detectAnomalies(trafficSources, null);
    const score = computeScore(visits, trafficSources, null);
    const metrics = buildMetrics(visits, trafficSources, null, null, 'SimilarWeb');

    return {
      estimatedMonthlyVisits: visits,
      trafficSources,
      topCountries: [],
      deviceSplit: { desktop: 60, mobile: 40 },
      bounceRate: overview?.bounce_rate ?? null,
      avgSessionDuration: overview?.average_visit_duration ?? null,
      pagesPerSession: overview?.pages_per_visit ?? null,
      topReferrers: [],
      paidSpendEstimate: null,
      topAdKeywords: [],
      anomalies,
      score,
      metrics,
    };
  } catch {
    return null;
  }
}

// ─── DataForSEO API ───────────────────────────────────────────────────────────

async function fetchDataForSEO(domain: string, config: APIConfig): Promise<TrafficData | null> {
  try {
    const credentials = Buffer.from(`${config.dataForSeoLogin}:${config.dataForSeoPassword}`).toString('base64');
    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };

    const body = JSON.stringify([{ target: domain, location_code: 2840, language_code: 'en' }]);

    const res = await fetchWithTimeout(
      'https://api.dataforseo.com/v3/domain_analytics/overview/live',
      { method: 'POST', headers, body },
      20000
    );

    if (!res.ok) return null;

    const json = await res.json();
    const item = json?.tasks?.[0]?.result?.[0];
    if (!item) return null;

    const visits: number = item.metrics?.organic?.etv ?? null;
    const organicShare = 55;
    const paidShare = item.metrics?.paid?.etv
      ? Math.round((item.metrics.paid.etv / (item.metrics.organic.etv + item.metrics.paid.etv)) * 100)
      : 10;

    const trafficSources = {
      organic: organicShare,
      paid: paidShare,
      direct: 20,
      referral: 10,
      social: 100 - organicShare - paidShare - 20 - 10,
    };

    const anomalies = detectAnomalies(trafficSources, null);
    const score = computeScore(visits, trafficSources, null);
    const metrics = buildMetrics(visits, trafficSources, null, null, 'DataForSEO');

    return {
      estimatedMonthlyVisits: visits,
      trafficSources,
      topCountries: [],
      deviceSplit: { desktop: 58, mobile: 42 },
      bounceRate: null,
      avgSessionDuration: null,
      pagesPerSession: null,
      topReferrers: [],
      paidSpendEstimate: item.metrics?.paid?.cost ?? null,
      topAdKeywords: [],
      anomalies,
      score,
      metrics,
    };
  } catch {
    return null;
  }
}

// ─── Heuristic Analysis ───────────────────────────────────────────────────────

interface HeuristicSignals {
  hasGA: boolean;
  hasGTM: boolean;
  hasFBPixel: boolean;
  hasLinkedInInsight: boolean;
  hasCookieConsent: boolean;
  socialLinks: string[];
  metaDescription: string;
  ogTags: boolean;
  twitterCards: boolean;
  structuredData: boolean;
  canonicalTag: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  wordCount: number;
  hasSchemaOrg: boolean;
  hasNewsletterForm: boolean;
  hasBlog: boolean;
  hasEcommerce: boolean;
  hasPricingPage: boolean;
  hasContactForm: boolean;
  loadedSuccessfully: boolean;
  indexedPages: number | null;
}

async function crawlHomepage(domain: string): Promise<HeuristicSignals> {
  const defaultSignals: HeuristicSignals = {
    hasGA: false,
    hasGTM: false,
    hasFBPixel: false,
    hasLinkedInInsight: false,
    hasCookieConsent: false,
    socialLinks: [],
    metaDescription: '',
    ogTags: false,
    twitterCards: false,
    structuredData: false,
    canonicalTag: false,
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    wordCount: 0,
    hasSchemaOrg: false,
    hasNewsletterForm: false,
    hasBlog: false,
    hasEcommerce: false,
    hasPricingPage: false,
    hasContactForm: false,
    loadedSuccessfully: false,
    indexedPages: null,
  };

  try {
    const url = `https://${domain}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TrafficAnalyzer/1.0; +https://example.com/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      },
      15000
    );

    if (!res.ok && res.status !== 304) {
      // Try http fallback
      const httpRes = await fetchWithTimeout(
        `http://${domain}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TrafficAnalyzer/1.0)',
            Accept: 'text/html',
          },
        },
        10000
      );
      if (!httpRes.ok) return defaultSignals;
      const html = await httpRes.text();
      return parseHTML(html, domain);
    }

    const html = await res.text();
    return parseHTML(html, domain);
  } catch {
    return defaultSignals;
  }
}

function parseHTML(html: string, domain: string): HeuristicSignals {
  const $ = cheerio.load(html);
  const signals: HeuristicSignals = {
    hasGA: false,
    hasGTM: false,
    hasFBPixel: false,
    hasLinkedInInsight: false,
    hasCookieConsent: false,
    socialLinks: [],
    metaDescription: '',
    ogTags: false,
    twitterCards: false,
    structuredData: false,
    canonicalTag: false,
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    wordCount: 0,
    hasSchemaOrg: false,
    hasNewsletterForm: false,
    hasBlog: false,
    hasEcommerce: false,
    hasPricingPage: false,
    hasContactForm: false,
    loadedSuccessfully: true,
    indexedPages: null,
  };

  // Analytics detection
  const scripts = $('script').map((_, el) => $(el).html() || $(el).attr('src') || '').get().join(' ');
  signals.hasGA =
    /gtag\s*\(|google-analytics\.com|UA-\d+|G-[A-Z0-9]+/.test(html);
  signals.hasGTM =
    /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/.test(html);
  signals.hasFBPixel =
    /fbq\s*\(|connect\.facebook\.net|facebook\.com\/tr/.test(html);
  signals.hasLinkedInInsight =
    /linkedin\.com\/insight|_linkedin_partner_id/.test(html);
  signals.hasCookieConsent =
    /cookiebot|cookieconsent|onetrust|trustarc|gdpr|cookie-consent|cookie_consent/i.test(html);

  // Meta tags
  signals.metaDescription = $('meta[name="description"]').attr('content') || '';
  signals.ogTags = $('meta[property^="og:"]').length > 0;
  signals.twitterCards = $('meta[name^="twitter:"]').length > 0;
  signals.canonicalTag = $('link[rel="canonical"]').length > 0;
  signals.structuredData =
    $('script[type="application/ld+json"]').length > 0;
  signals.hasSchemaOrg = html.includes('schema.org');

  // Social links
  const socialPatterns: Record<string, RegExp> = {
    twitter: /twitter\.com\//,
    linkedin: /linkedin\.com\//,
    facebook: /facebook\.com\//,
    instagram: /instagram\.com\//,
    youtube: /youtube\.com\//,
    tiktok: /tiktok\.com\//,
  };
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      if (pattern.test(href) && !signals.socialLinks.includes(platform)) {
        signals.socialLinks.push(platform);
      }
    }
  });

  // Link analysis
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('http') && !href.includes(domain)) {
      signals.externalLinkCount++;
    } else if (href.startsWith('/') || href.includes(domain)) {
      signals.internalLinkCount++;
    }
  });

  // Image count
  signals.imageCount = $('img').length;

  // Word count (rough)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  signals.wordCount = bodyText.split(' ').filter((w) => w.length > 2).length;

  // Content signals
  const allLinks = $('a[href]')
    .map((_, el) => ($(el).attr('href') || '').toLowerCase())
    .get()
    .join(' ');
  const allText = html.toLowerCase();

  signals.hasBlog =
    /\/blog|\/news|\/articles|\/insights|\/resources/.test(allLinks) ||
    /\/blog|\/news|\/articles/.test(allText);
  signals.hasEcommerce =
    /cart|checkout|add.to.bag|add.to.cart|buy.now|shop\b/.test(allText) ||
    /woocommerce|shopify|magento/.test(html);
  signals.hasPricingPage =
    /\/pricing|\/plans|\/packages/.test(allLinks) ||
    /pricing|per.month|per.year|subscription/.test(allText);
  signals.hasContactForm =
    /\/contact|contact.us/.test(allLinks) ||
    $('form').length > 0;
  signals.hasNewsletterForm =
    /newsletter|subscribe|email.signup/.test(allText) ||
    $('input[type="email"]').length > 0;

  return signals;
}

async function estimateIndexedPages(domain: string, config: APIConfig): Promise<number | null> {
  if (!hasKey(config, 'googleSearchKey') || !hasKey(config, 'googleSearchCx')) {
    return null;
  }
  try {
    const query = encodeURIComponent(`site:${domain}`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${config.googleSearchKey}&cx=${config.googleSearchCx}&q=${query}&num=1`;
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) return null;
    const json = await res.json();
    const total = json?.searchInformation?.totalResults;
    return total ? parseInt(total, 10) : null;
  } catch {
    return null;
  }
}

function estimateTrafficFromSignals(
  signals: HeuristicSignals,
  indexedPages: number | null
): {
  visits: number;
  sources: TrafficData['trafficSources'];
  bounceRate: number;
  sessionDuration: number;
  pagesPerSession: number;
} {
  // Base score from sophistication signals
  let sophisticationScore = 0;

  if (signals.hasGA) sophisticationScore += 15;
  if (signals.hasGTM) sophisticationScore += 10;
  if (signals.hasFBPixel) sophisticationScore += 8;
  if (signals.hasLinkedInInsight) sophisticationScore += 5;
  if (signals.hasCookieConsent) sophisticationScore += 5;
  if (signals.ogTags) sophisticationScore += 5;
  if (signals.twitterCards) sophisticationScore += 5;
  if (signals.structuredData) sophisticationScore += 8;
  if (signals.canonicalTag) sophisticationScore += 5;
  if (signals.hasBlog) sophisticationScore += 8;
  if (signals.hasPricingPage) sophisticationScore += 6;
  if (signals.hasEcommerce) sophisticationScore += 5;
  if (signals.socialLinks.length >= 3) sophisticationScore += 5;
  if (signals.wordCount > 500) sophisticationScore += 5;
  if (signals.internalLinkCount > 20) sophisticationScore += 5;

  sophisticationScore = clamp(sophisticationScore, 0, 100);

  // Map sophistication to traffic tiers
  // Tier 1 (0-20): very small / startup: 1K–20K/mo
  // Tier 2 (20-40): early growth: 20K–100K/mo
  // Tier 3 (40-60): established SMB: 100K–500K/mo
  // Tier 4 (60-80): mature brand: 500K–2M/mo
  // Tier 5 (80-100): enterprise: 2M–10M/mo
  let baseVisits: number;
  if (sophisticationScore < 20) {
    baseVisits = lerp(1_000, 20_000, sophisticationScore / 20);
  } else if (sophisticationScore < 40) {
    baseVisits = lerp(20_000, 100_000, (sophisticationScore - 20) / 20);
  } else if (sophisticationScore < 60) {
    baseVisits = lerp(100_000, 500_000, (sophisticationScore - 40) / 20);
  } else if (sophisticationScore < 80) {
    baseVisits = lerp(500_000, 2_000_000, (sophisticationScore - 60) / 20);
  } else {
    baseVisits = lerp(2_000_000, 10_000_000, (sophisticationScore - 80) / 20);
  }

  // Adjust by indexed pages if available
  if (indexedPages !== null) {
    // More indexed pages → more organic traffic; pages/visit ratio varies
    const pageMultiplier = clamp(1 + Math.log10(Math.max(indexedPages, 1)) / 10, 0.5, 3);
    baseVisits = baseVisits * pageMultiplier;
  }

  // Determine source distribution
  let organic = 40;
  let paid = 10;
  let direct = 20;
  let referral = 10;
  let social = 20;

  if (signals.hasGA || signals.hasGTM) {
    organic += 10; // analytics-aware sites often invest in SEO
  }
  if (signals.hasFBPixel) {
    paid += 10;
    social += 5;
    organic -= 10;
    direct -= 5;
  }
  if (signals.hasLinkedInInsight) {
    paid += 5;
    social += 5;
    organic -= 5;
    direct -= 5;
  }
  if (signals.hasBlog) {
    organic += 10;
    direct -= 5;
    referral += 5;
    social -= 5;
    paid -= 5;
  }
  if (signals.socialLinks.length >= 4) {
    social += 10;
    direct -= 5;
    referral -= 5;
  }
  if (!signals.hasGA && !signals.hasGTM) {
    // Less sophisticated: more direct, less organic
    direct += 15;
    organic -= 10;
    paid -= 5;
  }

  // Normalize
  const srcTotal = organic + paid + direct + referral + social;
  const norm = (n: number) => Math.max(0, Math.round((n / srcTotal) * 100));

  const sources: TrafficData['trafficSources'] = {
    organic: norm(organic),
    paid: norm(paid),
    direct: norm(direct),
    referral: norm(referral),
    social: norm(social),
  };

  // Session metrics based on content quality
  const bounceRate = clamp(85 - sophisticationScore * 0.4, 30, 85);
  const sessionDuration = clamp(sophisticationScore * 1.5 + 45, 45, 250);
  const pagesPerSession = clamp(1 + sophisticationScore / 40, 1.2, 5);

  return {
    visits: Math.round(baseVisits),
    sources,
    bounceRate: parseFloat(bounceRate.toFixed(1)),
    sessionDuration: parseFloat(sessionDuration.toFixed(0)),
    pagesPerSession: parseFloat(pagesPerSession.toFixed(1)),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function detectSocialReferrers(signals: HeuristicSignals): TrafficData['topReferrers'] {
  const knownAuthority: Record<string, number> = {
    twitter: 85,
    linkedin: 88,
    facebook: 90,
    instagram: 82,
    youtube: 92,
    tiktok: 78,
    reddit: 80,
    pinterest: 76,
  };

  return signals.socialLinks.map((platform) => ({
    domain: `${platform}.com`,
    authority: knownAuthority[platform] ?? 70,
  }));
}

async function heuristicAnalysis(domain: string, config: APIConfig): Promise<TrafficData> {
  const [signals, indexedPages] = await Promise.all([
    crawlHomepage(domain),
    estimateIndexedPages(domain, config),
  ]);

  const sigWithPages: HeuristicSignals = { ...signals, indexedPages };
  const estimated = estimateTrafficFromSignals(sigWithPages, indexedPages);
  const anomalies = detectAnomalies(estimated.sources, estimated.visits);
  const score = computeScore(estimated.visits, estimated.sources, estimated.bounceRate);
  const topReferrers = detectSocialReferrers(signals);
  const metrics = buildMetrics(
    estimated.visits,
    estimated.sources,
    estimated.bounceRate,
    indexedPages,
    'Heuristic'
  );

  // Infer ad keywords from domain name / content type
  const topAdKeywords: string[] = [];
  if (signals.hasPricingPage) topAdKeywords.push(`${domain} pricing`, `${domain} plans`);
  if (signals.hasEcommerce) topAdKeywords.push(`buy ${domain}`, `${domain} discount`);

  return {
    estimatedMonthlyVisits: estimated.visits,
    trafficSources: estimated.sources,
    topCountries: [
      { country: 'US', share: 45 },
      { country: 'GB', share: 12 },
      { country: 'CA', share: 8 },
      { country: 'AU', share: 6 },
      { country: 'DE', share: 5 },
    ],
    deviceSplit: {
      desktop: signals.hasEcommerce ? 45 : 55,
      mobile: signals.hasEcommerce ? 55 : 45,
    },
    bounceRate: estimated.bounceRate,
    avgSessionDuration: estimated.sessionDuration,
    pagesPerSession: estimated.pagesPerSession,
    topReferrers,
    paidSpendEstimate:
      estimated.sources.paid > 0
        ? Math.round((estimated.visits * 0.01 * estimated.sources.paid) / 100 * 1.5)
        : null,
    topAdKeywords,
    anomalies,
    score,
    metrics,
  };
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

function detectAnomalies(
  sources: TrafficData['trafficSources'],
  visits: number | null
): string[] {
  const anomalies: string[] = [];

  if (sources.paid > 60) {
    anomalies.push(
      `High paid dependency: ${sources.paid}% of traffic from paid channels — significant risk if ad budget is cut`
    );
  }
  if (sources.organic < 15) {
    anomalies.push(
      `Low organic share: only ${sources.organic}% organic traffic indicates weak SEO foundation`
    );
  }
  if (sources.direct > 50) {
    anomalies.push(
      `Unusually high direct traffic (${sources.direct}%) — may indicate dark social, branded search, or measurement gaps`
    );
  }
  if (sources.social < 5) {
    anomalies.push(
      `Minimal social traffic (${sources.social}%) — limited social media presence or engagement`
    );
  }
  if (sources.referral < 3) {
    anomalies.push(
      `Very low referral traffic (${sources.referral}%) — few external sites linking or partnering`
    );
  }
  if (visits !== null && visits < 5_000) {
    anomalies.push(
      `Very low estimated traffic (${visits.toLocaleString()} visits/month) — early-stage or niche audience`
    );
  }

  return anomalies;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScore(
  visits: number | null,
  sources: TrafficData['trafficSources'],
  bounceRate: number | null
): number {
  let score = 50; // base

  // Traffic volume component (0–30 points)
  if (visits !== null) {
    if (visits >= 1_000_000) score += 30;
    else if (visits >= 500_000) score += 25;
    else if (visits >= 100_000) score += 20;
    else if (visits >= 50_000) score += 15;
    else if (visits >= 10_000) score += 10;
    else if (visits >= 1_000) score += 5;
    else score -= 10;
  }

  // Channel diversity component (0–20 points)
  const channelCount = Object.values(sources).filter((v) => v > 5).length;
  score += channelCount * 4;

  // Paid dependency penalty (–0 to –20 points)
  if (sources.paid > 60) score -= 20;
  else if (sources.paid > 40) score -= 10;
  else if (sources.paid > 25) score -= 5;

  // Organic health bonus (0–10 points)
  if (sources.organic >= 50) score += 10;
  else if (sources.organic >= 30) score += 5;

  // Bounce rate component (–10 to +10 points)
  if (bounceRate !== null) {
    if (bounceRate < 35) score += 10;
    else if (bounceRate < 50) score += 5;
    else if (bounceRate > 75) score -= 10;
    else if (bounceRate > 65) score -= 5;
  }

  return clamp(Math.round(score), 0, 100);
}

// ─── Metrics Builder ──────────────────────────────────────────────────────────

function buildMetrics(
  visits: number | null,
  sources: TrafficData['trafficSources'],
  bounceRate: number | null,
  indexedPages: number | null,
  source: string
): ScoredMetric[] {
  const metrics: ScoredMetric[] = [];

  // Monthly visits metric
  const visitScore = visits === null
    ? 30
    : visits >= 1_000_000
    ? 90
    : visits >= 100_000
    ? 70
    : visits >= 10_000
    ? 50
    : visits >= 1_000
    ? 35
    : 20;

  metrics.push({
    label: 'Monthly Visits',
    value: visits ?? 'Unknown',
    score: visitScore,
    status: ragFromScore(visitScore),
    source,
    explanation:
      visits !== null
        ? `Estimated ${visits.toLocaleString()} monthly visits`
        : 'Could not determine visit volume',
  });

  // Organic traffic metric
  const organicScore = clamp(sources.organic * 1.5, 0, 100);
  metrics.push({
    label: 'Organic Traffic Share',
    value: `${sources.organic}%`,
    score: organicScore,
    status: ragFromScore(organicScore, { green: 60, amber: 30 }),
    source,
    explanation:
      sources.organic >= 50
        ? 'Strong organic search presence'
        : sources.organic >= 30
        ? 'Moderate organic traffic — room for SEO improvement'
        : 'Low organic share — heavy reliance on other channels',
  });

  // Paid traffic risk metric
  const paidRiskScore = clamp(100 - sources.paid * 1.5, 0, 100);
  metrics.push({
    label: 'Paid Traffic Dependency',
    value: `${sources.paid}%`,
    score: paidRiskScore,
    status: ragFromScore(paidRiskScore, { green: 70, amber: 40 }),
    source,
    explanation:
      sources.paid > 60
        ? 'High paid dependency — vulnerable to budget cuts'
        : sources.paid > 30
        ? 'Moderate paid spend — manageable risk'
        : 'Low paid dependency — sustainable traffic mix',
  });

  // Channel diversity metric
  const activeChannels = Object.values(sources).filter((v) => v > 5).length;
  const diversityScore = clamp(activeChannels * 20, 0, 100);
  metrics.push({
    label: 'Channel Diversity',
    value: `${activeChannels} active channels`,
    score: diversityScore,
    status: ragFromScore(diversityScore, { green: 60, amber: 40 }),
    source,
    explanation:
      activeChannels >= 4
        ? 'Well-diversified traffic mix across multiple channels'
        : activeChannels >= 2
        ? 'Moderate channel diversity — consider expanding'
        : 'Concentrated traffic risk — limited channel diversity',
  });

  // Bounce rate metric (lower is better)
  if (bounceRate !== null) {
    const bounceScore = clamp(100 - bounceRate, 0, 100);
    metrics.push({
      label: 'Bounce Rate',
      value: `${bounceRate}%`,
      score: bounceScore,
      status: ragFromScore(bounceScore, { green: 50, amber: 30 }),
      source,
      explanation:
        bounceRate < 40
          ? 'Excellent engagement — visitors explore multiple pages'
          : bounceRate < 60
          ? 'Average engagement — some single-page visits'
          : 'High bounce rate — visitors leaving without engaging',
    });
  }

  // Indexed pages metric
  if (indexedPages !== null) {
    const pageScore = clamp(
      indexedPages >= 10_000
        ? 90
        : indexedPages >= 1_000
        ? 70
        : indexedPages >= 100
        ? 50
        : 30,
      0,
      100
    );
    metrics.push({
      label: 'Indexed Pages',
      value: indexedPages,
      score: pageScore,
      status: ragFromScore(pageScore),
      source: 'Google Search',
      explanation: `${indexedPages.toLocaleString()} pages indexed by Google`,
    });
  }

  return metrics;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function analyzeTraffic(domain: string, config: APIConfig): Promise<TrafficData> {
  // 1. Try SimilarWeb first
  if (hasKey(config, 'similarwebKey')) {
    const result = await fetchSimilarWeb(domain, config);
    if (result) return result;
  }

  // 2. Try DataForSEO
  if (hasKey(config, 'dataForSeoLogin') && hasKey(config, 'dataForSeoPassword')) {
    const result = await fetchDataForSEO(domain, config);
    if (result) return result;
  }

  // 3. Fall back to heuristic crawl-based analysis
  return heuristicAnalysis(domain, config);
}
