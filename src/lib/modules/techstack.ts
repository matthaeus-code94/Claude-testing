import { APIConfig, TechStackData, RAGStatus, ScoredMetric } from '@/types';
import { fetchWithTimeout, ragFromScore } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';
import * as cheerio from 'cheerio';

interface TechSignature {
  name: string;
  category: string;
  patterns: RegExp[];
  headerPatterns?: Record<string, RegExp>;
  confidence: number;
}

const SIGNATURES: TechSignature[] = [
  // CMS
  { name: 'WordPress', category: 'CMS', patterns: [/wp-content/i, /wp-includes/i, /wp-json/i], confidence: 0.95 },
  { name: 'Drupal', category: 'CMS', patterns: [/drupal\.js/i, /\/sites\/default\//i], confidence: 0.9 },
  { name: 'Shopify', category: 'E-Commerce', patterns: [/cdn\.shopify\.com/i, /shopify\.com/i, /Shopify\.theme/i], confidence: 0.95 },
  { name: 'Squarespace', category: 'CMS', patterns: [/squarespace\.com/i, /static\.squarespace/i], confidence: 0.9 },
  { name: 'Wix', category: 'CMS', patterns: [/wix\.com/i, /wixstatic\.com/i, /parastorage\.com/i], confidence: 0.9 },
  { name: 'Webflow', category: 'CMS', patterns: [/webflow\.com/i, /assets-global\.website-files/i], confidence: 0.9 },
  { name: 'Ghost', category: 'CMS', patterns: [/ghost\.io/i, /ghost-/i], confidence: 0.8 },
  { name: 'HubSpot CMS', category: 'CMS', patterns: [/hs-scripts\.com/i, /hubspot\.net/i], confidence: 0.85 },
  // Frontend frameworks
  { name: 'React', category: 'Frontend', patterns: [/__NEXT_DATA__/i, /react-root/i, /_next\//i, /reactDOM/i], confidence: 0.85 },
  { name: 'Next.js', category: 'Frontend', patterns: [/__NEXT_DATA__/i, /_next\/static/i, /next\/router/i], confidence: 0.9 },
  { name: 'Vue.js', category: 'Frontend', patterns: [/vue\.js/i, /vue\.min\.js/i, /v-bind/i, /v-model/i], confidence: 0.85 },
  { name: 'Nuxt', category: 'Frontend', patterns: [/__NUXT__/i, /_nuxt\//i], confidence: 0.9 },
  { name: 'Angular', category: 'Frontend', patterns: [/ng-version/i, /angular\.js/i, /ng-app/i], confidence: 0.85 },
  { name: 'Svelte', category: 'Frontend', patterns: [/svelte/i, /__SVELTEKIT/i], confidence: 0.8 },
  { name: 'Gatsby', category: 'Frontend', patterns: [/gatsby/i, /___gatsby/i], confidence: 0.9 },
  // E-Commerce
  { name: 'WooCommerce', category: 'E-Commerce', patterns: [/woocommerce/i, /wc-/i], confidence: 0.9 },
  { name: 'Magento', category: 'E-Commerce', patterns: [/magento/i, /mage\//i, /varien/i], confidence: 0.9 },
  { name: 'BigCommerce', category: 'E-Commerce', patterns: [/bigcommerce\.com/i], confidence: 0.9 },
  // Analytics
  { name: 'Google Analytics 4', category: 'Analytics', patterns: [/gtag\(/i, /googletagmanager\.com\/gtag/i, /G-[A-Z0-9]+/], confidence: 0.95 },
  { name: 'Google Tag Manager', category: 'Analytics', patterns: [/googletagmanager\.com\/gtm/i, /GTM-[A-Z0-9]+/], confidence: 0.95 },
  { name: 'Segment', category: 'Analytics', patterns: [/segment\.com\/analytics/i, /cdn\.segment\.com/i], confidence: 0.9 },
  { name: 'Mixpanel', category: 'Analytics', patterns: [/mixpanel\.com/i, /mixpanel\.init/i], confidence: 0.9 },
  { name: 'Hotjar', category: 'Analytics', patterns: [/hotjar\.com/i, /hj\(/i], confidence: 0.9 },
  { name: 'Amplitude', category: 'Analytics', patterns: [/amplitude\.com/i, /amplitude\.getInstance/i], confidence: 0.85 },
  { name: 'Heap', category: 'Analytics', patterns: [/heap\.io/i, /heapanalytics\.com/i], confidence: 0.85 },
  { name: 'Plausible', category: 'Analytics', patterns: [/plausible\.io/i], confidence: 0.9 },
  // Marketing
  { name: 'HubSpot', category: 'Marketing', patterns: [/js\.hs-scripts\.com/i, /hs-banner\.com/i], confidence: 0.9 },
  { name: 'Marketo', category: 'Marketing', patterns: [/marketo\.net/i, /munchkin/i], confidence: 0.9 },
  { name: 'Intercom', category: 'Marketing', patterns: [/intercom\.io/i, /intercomSettings/i], confidence: 0.9 },
  { name: 'Drift', category: 'Marketing', patterns: [/drift\.com/i, /driftt/i], confidence: 0.9 },
  { name: 'Crisp', category: 'Marketing', patterns: [/crisp\.chat/i], confidence: 0.9 },
  { name: 'Mailchimp', category: 'Marketing', patterns: [/mailchimp\.com/i, /chimpstatic\.com/i], confidence: 0.9 },
  // Tech debt signals
  { name: 'jQuery', category: 'Legacy', patterns: [/jquery[.-]?\d/i, /jquery\.min\.js/i], confidence: 0.95 },
  { name: 'Bootstrap', category: 'CSS Framework', patterns: [/bootstrap\.min/i, /getbootstrap\.com/i], confidence: 0.9 },
  // Performance / CDN
  { name: 'Cloudflare', category: 'CDN', patterns: [/cloudflare/i, /cf-ray/i], confidence: 0.8 },
  { name: 'Fastly', category: 'CDN', patterns: [/fastly/i], confidence: 0.8 },
  { name: 'AWS CloudFront', category: 'CDN', patterns: [/cloudfront\.net/i], confidence: 0.85 },
  // Hosting
  { name: 'Vercel', category: 'Hosting', patterns: [/vercel/i, /\.vercel\.app/i], confidence: 0.85 },
  { name: 'Netlify', category: 'Hosting', patterns: [/netlify/i, /\.netlify\.app/i], confidence: 0.85 },
  { name: 'Heroku', category: 'Hosting', patterns: [/heroku/i, /herokuapp\.com/i], confidence: 0.85 },
];

const THIRD_PARTY_CATEGORIES: Record<string, { category: string; riskLevel: RAGStatus }> = {
  'google-analytics': { category: 'Analytics', riskLevel: 'green' },
  'googletagmanager': { category: 'Tag Management', riskLevel: 'green' },
  'facebook': { category: 'Social / Ads', riskLevel: 'amber' },
  'meta': { category: 'Social / Ads', riskLevel: 'amber' },
  'doubleclick': { category: 'Advertising', riskLevel: 'amber' },
  'hotjar': { category: 'Session Recording', riskLevel: 'amber' },
  'fullstory': { category: 'Session Recording', riskLevel: 'red' },
  'intercom': { category: 'Customer Comms', riskLevel: 'green' },
  'drift': { category: 'Customer Comms', riskLevel: 'green' },
  'hubspot': { category: 'Marketing', riskLevel: 'green' },
  'segment': { category: 'CDP', riskLevel: 'green' },
  'stripe': { category: 'Payments', riskLevel: 'green' },
  'sentry': { category: 'Error Tracking', riskLevel: 'green' },
  'datadog': { category: 'Monitoring', riskLevel: 'green' },
  'tiktok': { category: 'Social / Ads', riskLevel: 'amber' },
  'twitter': { category: 'Social', riskLevel: 'green' },
  'linkedin': { category: 'Social / Ads', riskLevel: 'green' },
  'pinterest': { category: 'Social / Ads', riskLevel: 'green' },
  'crisp': { category: 'Customer Comms', riskLevel: 'green' },
  'clarity': { category: 'Analytics', riskLevel: 'green' },
};

async function fetchLighthouseScores(domain: string, config: APIConfig) {
  if (!hasKey(config, 'googlePsiKey')) return null;
  try {
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${domain}&key=${config.googlePsiKey}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;
    const res = await fetchWithTimeout(url, {}, 30000);
    if (!res.ok) return null;
    const data = await res.json();
    const cats = data.lighthouseResult?.categories;
    if (!cats) return null;
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
    };
  } catch {
    return null;
  }
}

export async function analyzeTechStack(domain: string, config: APIConfig): Promise<TechStackData> {
  const technologies: TechStackData['technologies'] = [];
  const thirdPartyScripts: TechStackData['thirdPartyScripts'] = [];
  const techDebtSignals: string[] = [];
  let security: TechStackData['security'] = {
    https: false,
    hsts: false,
    csp: false,
    xFrameOptions: false,
    cookieConsent: null,
  };

  // Fetch homepage
  let html = '';
  let headers: Record<string, string> = {};
  try {
    const res = await fetchWithTimeout(`https://${domain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DDBot/1.0; +https://digital-dd.com)' },
      redirect: 'follow',
    }, 15000);
    html = await res.text();
    security.https = true;

    // Extract headers
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Security headers
    security.hsts = !!headers['strict-transport-security'];
    security.csp = !!headers['content-security-policy'];
    security.xFrameOptions = !!headers['x-frame-options'];
  } catch {
    // Try HTTP
    try {
      const res = await fetchWithTimeout(`http://${domain}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DDBot/1.0)' },
        redirect: 'follow',
      }, 10000);
      html = await res.text();
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } catch {
      // Domain unreachable — return minimal data
    }
  }

  if (html) {
    const $ = cheerio.load(html);

    // Detect technologies from HTML
    for (const sig of SIGNATURES) {
      const matched = sig.patterns.some(p => p.test(html));
      if (matched) {
        technologies.push({
          category: sig.category,
          name: sig.name,
          confidence: sig.confidence,
        });
      }
    }

    // Detect from headers
    const serverHeader = headers['server'] || '';
    if (/nginx/i.test(serverHeader)) technologies.push({ category: 'Server', name: 'Nginx', confidence: 0.95 });
    if (/apache/i.test(serverHeader)) technologies.push({ category: 'Server', name: 'Apache', confidence: 0.95 });
    if (/cloudflare/i.test(serverHeader)) technologies.push({ category: 'CDN', name: 'Cloudflare', confidence: 0.95 });
    const poweredBy = headers['x-powered-by'] || '';
    if (/express/i.test(poweredBy)) technologies.push({ category: 'Backend', name: 'Express.js', confidence: 0.9 });
    if (/next\.js/i.test(poweredBy)) technologies.push({ category: 'Frontend', name: 'Next.js', confidence: 0.95 });
    if (/php/i.test(poweredBy)) technologies.push({ category: 'Backend', name: 'PHP', confidence: 0.9 });
    if (headers['x-vercel-id']) technologies.push({ category: 'Hosting', name: 'Vercel', confidence: 0.95 });
    if (headers['x-netlify-id'] || headers['x-nf-request-id']) technologies.push({ category: 'Hosting', name: 'Netlify', confidence: 0.95 });

    // Third-party scripts
    const scripts = $('script[src]').toArray();
    const seenDomains = new Set<string>();
    for (const el of scripts) {
      const src = $(el).attr('src') || '';
      if (!src || src.startsWith('/') || src.includes(domain)) continue;
      try {
        const scriptDomain = new URL(src.startsWith('//') ? 'https:' + src : src).hostname;
        if (seenDomains.has(scriptDomain)) continue;
        seenDomains.add(scriptDomain);

        const matchedKey = Object.keys(THIRD_PARTY_CATEGORIES).find(k => scriptDomain.includes(k));
        const info = matchedKey ? THIRD_PARTY_CATEGORIES[matchedKey] : { category: 'Other', riskLevel: 'green' as RAGStatus };
        thirdPartyScripts.push({
          name: scriptDomain,
          category: info.category,
          riskLevel: info.riskLevel,
        });
      } catch { /* invalid URL */ }
    }

    // Cookie consent detection
    const htmlLower = html.toLowerCase();
    security.cookieConsent = /cookie.?consent|cookie.?banner|gdpr|onetrust|cookiebot|osano|termly/i.test(htmlLower);

    // Tech debt signals
    if (technologies.some(t => t.name === 'jQuery')) {
      techDebtSignals.push('jQuery dependency detected — consider migration to modern framework');
    }
    const inlineStyles = $('[style]').length;
    if (inlineStyles > 50) {
      techDebtSignals.push(`Excessive inline styles (${inlineStyles} elements) — CSS architecture concern`);
    }
    if (/angular\.js.*1\./i.test(html)) {
      techDebtSignals.push('AngularJS 1.x detected — end-of-life framework, migration required');
    }
    if (/bootstrap.*[23]\./i.test(html)) {
      techDebtSignals.push('Legacy Bootstrap version detected');
    }
    const totalScripts = scripts.length;
    if (totalScripts > 30) {
      techDebtSignals.push(`High script count (${totalScripts}) — performance and maintainability risk`);
    }
    const htmlSize = html.length;
    if (htmlSize > 500_000) {
      techDebtSignals.push(`Large HTML payload (${(htmlSize / 1024).toFixed(0)}KB) — page weight concern`);
    }
    if (!security.https) {
      techDebtSignals.push('Site not served over HTTPS — critical security issue');
    }
  }

  // Lighthouse scores
  const lighthouseScores = await fetchLighthouseScores(domain, config);

  // Deduplicate technologies
  const uniqueTechs = new Map<string, (typeof technologies)[0]>();
  for (const t of technologies) {
    const existing = uniqueTechs.get(t.name);
    if (!existing || t.confidence > existing.confidence) {
      uniqueTechs.set(t.name, t);
    }
  }
  const dedupedTechs = Array.from(uniqueTechs.values());

  // Compute score
  let score = 50;
  if (security.https) score += 10;
  if (security.hsts) score += 5;
  if (security.csp) score += 5;
  if (security.xFrameOptions) score += 3;
  if (security.cookieConsent) score += 2;
  if (lighthouseScores) {
    score += Math.round(lighthouseScores.performance / 10);
  }
  score -= techDebtSignals.length * 5;
  score -= thirdPartyScripts.filter(s => s.riskLevel === 'red').length * 5;
  score = Math.max(0, Math.min(100, score));

  const metrics: ScoredMetric[] = [
    {
      label: 'Technologies Detected',
      value: dedupedTechs.length,
      score: dedupedTechs.length >= 5 ? 70 : 50,
      status: ragFromScore(dedupedTechs.length >= 5 ? 70 : 50),
      source: 'HTML/Header Analysis',
    },
    {
      label: 'Security Score',
      value: `${[security.https, security.hsts, security.csp, security.xFrameOptions].filter(Boolean).length}/4`,
      score: [security.https, security.hsts, security.csp, security.xFrameOptions].filter(Boolean).length * 25,
      status: ragFromScore([security.https, security.hsts, security.csp, security.xFrameOptions].filter(Boolean).length * 25),
      source: 'HTTP Header Analysis',
    },
    {
      label: 'Third-Party Scripts',
      value: thirdPartyScripts.length,
      score: thirdPartyScripts.length <= 10 ? 80 : thirdPartyScripts.length <= 20 ? 50 : 30,
      status: ragFromScore(thirdPartyScripts.length <= 10 ? 80 : thirdPartyScripts.length <= 20 ? 50 : 30),
      source: 'Script Analysis',
      explanation: `${thirdPartyScripts.filter(s => s.riskLevel === 'red').length} high-risk`,
    },
    {
      label: 'Tech Debt Signals',
      value: techDebtSignals.length,
      score: techDebtSignals.length === 0 ? 90 : techDebtSignals.length <= 2 ? 60 : 30,
      status: ragFromScore(techDebtSignals.length === 0 ? 90 : techDebtSignals.length <= 2 ? 60 : 30),
      source: 'Code Analysis',
    },
  ];

  if (lighthouseScores) {
    metrics.push({
      label: 'Lighthouse Performance',
      value: lighthouseScores.performance,
      score: lighthouseScores.performance,
      status: ragFromScore(lighthouseScores.performance, { green: 90, amber: 50 }),
      source: 'Google PageSpeed Insights API',
    });
  }

  return {
    technologies: dedupedTechs,
    lighthouseScores,
    security,
    thirdPartyScripts,
    techDebtSignals,
    score,
    metrics,
  };
}
