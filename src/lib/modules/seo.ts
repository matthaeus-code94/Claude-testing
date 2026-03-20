import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { APIConfig, RAGStatus, SEOData, ScoredMetric } from '@/types';
import { fetchWithTimeout, ragFromScore, clamp } from '@/lib/utils';
import { hasKey } from '@/lib/api-config';

// ─── Core Web Vitals Thresholds ───────────────────────────────────────────────

function lcpStatus(value: number): RAGStatus {
  if (value < 2500) return 'green';
  if (value < 4000) return 'amber';
  return 'red';
}

function clsStatus(value: number): RAGStatus {
  if (value < 0.1) return 'green';
  if (value < 0.25) return 'amber';
  return 'red';
}

function inpStatus(value: number): RAGStatus {
  if (value < 200) return 'green';
  if (value < 500) return 'amber';
  return 'red';
}

// ─── Types for internal use ───────────────────────────────────────────────────

interface CrawlResult {
  title: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  canonicalUrl: string | null;
  structuredDataTypes: string[];
  hasRobotsTxt: boolean;
  robotsDisallowsAll: boolean;
  hasSitemap: boolean;
  sitemapUrl: string | null;
  openGraphPresent: boolean;
  twitterCardPresent: boolean;
  crawlIssues: string[];
  estimatedDomainAuthority: number;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  pageLoadable: boolean;
  statusCode: number | null;
  isHttps: boolean;
  hasHreflang: boolean;
  viewportMetaPresent: boolean;
}

interface PSIResult {
  lcp: number;
  inp: number;
  cls: number;
  mobileFriendly: boolean;
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
}

interface DataForSEOKeywordResult {
  organicKeywordCount: number;
  rankingDistribution: { top3: number; top10: number; top30: number };
  topKeywords: { keyword: string; position: number; volume: number }[];
  domainAuthority: number | null;
  serpFeatures: { featuredSnippets: boolean; peopleAlsoAsk: boolean; localPacks: boolean };
}

// ─── Google PageSpeed Insights ────────────────────────────────────────────────

async function fetchPSI(domain: string, apiKey: string): Promise<PSIResult | null> {
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${domain}&key=${apiKey}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;

  try {
    const res = await fetchWithTimeout(url, {}, 30000);
    if (!res.ok) {
      console.warn(`[SEO] PSI API returned ${res.status} for ${domain}`);
      return null;
    }

    const data = await res.json();
    const audits = data?.lighthouseResult?.audits ?? {};
    const categories = data?.lighthouseResult?.categories ?? {};

    // Core Web Vitals — PSI returns numeric metric values in milliseconds or unitless
    const lcpAudit = audits['largest-contentful-paint'];
    const clsAudit = audits['cumulative-layout-shift'];
    const inpAudit = audits['interaction-to-next-paint'] ?? audits['total-blocking-time'];

    // LCP value is in seconds from PSI — convert to ms
    const lcpValue = lcpAudit?.numericValue ?? null;
    const clsValue = clsAudit?.numericValue ?? null;
    const inpValue = inpAudit?.numericValue ?? null;

    // Mobile-friendly: check viewport audit
    const viewportAudit = audits['viewport'];
    const mobileAudit = audits['uses-responsive-images'];
    const mobileFriendly =
      viewportAudit?.score === 1 ||
      (data?.loadingExperience?.overall_category !== 'SLOW');

    if (lcpValue === null && clsValue === null) {
      return null;
    }

    return {
      lcp: lcpValue ?? 4000,
      inp: inpValue ?? 500,
      cls: clsValue ?? 0.25,
      mobileFriendly: mobileFriendly ?? false,
      performanceScore: Math.round((categories?.performance?.score ?? 0) * 100),
      accessibilityScore: Math.round((categories?.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round((categories?.['best-practices']?.score ?? 0) * 100),
      seoScore: Math.round((categories?.seo?.score ?? 0) * 100),
    };
  } catch (err) {
    console.warn('[SEO] PSI fetch failed:', err);
    return null;
  }
}

// ─── DataForSEO ───────────────────────────────────────────────────────────────

async function fetchDataForSEO(
  domain: string,
  login: string,
  password: string,
): Promise<DataForSEOKeywordResult | null> {
  const credentials = Buffer.from(`${login}:${password}`).toString('base64');
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };

  try {
    // Domain overview — provides keyword count and domain authority
    const overviewPayload = [{ target: domain, location_code: 2840, language_code: 'en' }];
    const overviewRes = await fetchWithTimeout(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live',
      { method: 'POST', headers, body: JSON.stringify(overviewPayload) },
      20000,
    );

    let organicKeywordCount = 0;
    let domainAuthority: number | null = null;
    let rankingDistribution = { top3: 0, top10: 0, top30: 0 };

    if (overviewRes.ok) {
      const overviewData = await overviewRes.json();
      const item = overviewData?.tasks?.[0]?.result?.[0];
      if (item) {
        organicKeywordCount = item.metrics?.organic?.count ?? 0;
        domainAuthority = item.domain_rank ?? null;
        const etv = item.metrics?.organic?.etv ?? 0;
        // Approximate distribution from available data
        const total = organicKeywordCount;
        rankingDistribution = {
          top3: Math.round(total * 0.05),
          top10: Math.round(total * 0.15),
          top30: Math.round(total * 0.35),
        };
      }
    }

    // Top keywords — ranked keywords for the domain
    const keywordsPayload = [
      {
        target: domain,
        location_code: 2840,
        language_code: 'en',
        limit: 10,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
        filters: ['ranked_serp_element.serp_item.type', '=', 'organic'],
      },
    ];
    const keywordsRes = await fetchWithTimeout(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
      { method: 'POST', headers, body: JSON.stringify(keywordsPayload) },
      20000,
    );

    const topKeywords: { keyword: string; position: number; volume: number }[] = [];
    let serpFeatures = { featuredSnippets: false, peopleAlsoAsk: false, localPacks: false };

    if (keywordsRes.ok) {
      const keywordsData = await keywordsRes.json();
      const items = keywordsData?.tasks?.[0]?.result?.[0]?.items ?? [];
      for (const item of items) {
        const keyword = item.keyword_data?.keyword;
        const position = item.ranked_serp_element?.serp_item?.rank_absolute ?? 0;
        const volume = item.keyword_data?.keyword_info?.search_volume ?? 0;
        if (keyword) {
          topKeywords.push({ keyword, position, volume });
        }

        // Check SERP features
        const serpTypes: string[] = item.keyword_data?.serp_info?.serp_item_types ?? [];
        if (serpTypes.includes('featured_snippet')) serpFeatures.featuredSnippets = true;
        if (serpTypes.includes('people_also_ask')) serpFeatures.peopleAlsoAsk = true;
        if (serpTypes.includes('local_pack')) serpFeatures.localPacks = true;
      }

      // Build ranking distribution from actual positions
      if (items.length > 0) {
        type RankedItem = { ranked_serp_element?: { serp_item?: { rank_absolute?: number } } };
        const typedItems = items as RankedItem[];
        const top3 = typedItems.filter(
          (i) => (i.ranked_serp_element?.serp_item?.rank_absolute ?? 999) <= 3,
        ).length;
        const top10 = typedItems.filter(
          (i) => (i.ranked_serp_element?.serp_item?.rank_absolute ?? 999) <= 10,
        ).length;
        const top30 = typedItems.filter(
          (i) => (i.ranked_serp_element?.serp_item?.rank_absolute ?? 999) <= 30,
        ).length;
        // Scale to overall keyword count
        const sampleRatio = organicKeywordCount / Math.max(items.length, 1);
        rankingDistribution = {
          top3: Math.round(top3 * sampleRatio),
          top10: Math.round(top10 * sampleRatio),
          top30: Math.round(top30 * sampleRatio),
        };
      }
    }

    return {
      organicKeywordCount,
      rankingDistribution,
      topKeywords,
      domainAuthority,
      serpFeatures,
    };
  } catch (err) {
    console.warn('[SEO] DataForSEO fetch failed:', err);
    return null;
  }
}

// ─── Crawl-based Analysis ─────────────────────────────────────────────────────

async function crawlDomain(domain: string): Promise<CrawlResult> {
  const baseUrl = `https://${domain}`;
  const issues: string[] = [];

  let pageLoadable = false;
  let statusCode: number | null = null;
  let $: cheerio.CheerioAPI | null = null;
  let htmlContent = '';

  // Fetch homepage
  try {
    const res = await fetchWithTimeout(
      baseUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SEOAnalyzer/1.0; +https://example.com/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      15000,
    );
    statusCode = res.status;

    if (res.ok) {
      pageLoadable = true;
      htmlContent = await res.text();
      $ = cheerio.load(htmlContent);
    } else {
      issues.push(`Homepage returned HTTP ${res.status}`);
    }
  } catch (err) {
    issues.push('Homepage fetch failed or timed out');
  }

  // Parse HTML elements
  let title: string | null = null;
  let metaDescription: string | null = null;
  const h1Tags: string[] = [];
  let canonicalUrl: string | null = null;
  const structuredDataTypes: string[] = [];
  let openGraphPresent = false;
  let twitterCardPresent = false;
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  let imageCount = 0;
  let imagesWithoutAlt = 0;
  let hasHreflang = false;
  let viewportMetaPresent = false;

  if ($ !== null) {
    // Title
    title = $('title').first().text().trim() || null;
    if (!title) {
      issues.push('Missing or empty <title> tag');
    } else if (title.length > 60) {
      issues.push(`Title tag too long (${title.length} chars, recommended ≤60)`);
    } else if (title.length < 10) {
      issues.push(`Title tag too short (${title.length} chars, recommended ≥10)`);
    }

    // Meta description
    metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || null;
    if (!metaDescription) {
      issues.push('Missing meta description');
    } else if (metaDescription.length > 160) {
      issues.push(`Meta description too long (${metaDescription.length} chars, recommended ≤160)`);
    } else if (metaDescription.length < 50) {
      issues.push(`Meta description too short (${metaDescription.length} chars, recommended ≥50)`);
    }

    // H1 tags
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1Tags.push(text);
    });
    if (h1Tags.length === 0) {
      issues.push('No H1 tag found on homepage');
    } else if (h1Tags.length > 1) {
      issues.push(`Multiple H1 tags found (${h1Tags.length}) — use only one per page`);
    }

    // Canonical URL
    canonicalUrl = $('link[rel="canonical"]').attr('href') || null;
    if (!canonicalUrl) {
      issues.push('Missing canonical URL tag');
    }

    // Open Graph
    openGraphPresent = $('meta[property^="og:"]').length > 0;
    if (!openGraphPresent) {
      issues.push('No Open Graph meta tags found');
    }

    // Twitter Card
    twitterCardPresent = $('meta[name^="twitter:"]').length > 0;

    // Viewport meta (mobile-friendliness indicator)
    viewportMetaPresent = $('meta[name="viewport"]').length > 0;
    if (!viewportMetaPresent) {
      issues.push('Missing viewport meta tag — may impact mobile usability');
    }

    // Hreflang
    hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;

    // Structured data (JSON-LD)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const extractTypes = (obj: Record<string, unknown>): void => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            (obj as unknown[]).forEach((item) => extractTypes(item as Record<string, unknown>));
            return;
          }
          const type = obj['@type'];
          if (type) {
            if (Array.isArray(type)) {
              (type as string[]).forEach((t: string) => {
                if (!structuredDataTypes.includes(t)) structuredDataTypes.push(t);
              });
            } else if (typeof type === 'string' && !structuredDataTypes.includes(type)) {
              structuredDataTypes.push(type);
            }
          }
          Object.values(obj).forEach((val) => {
            if (val && typeof val === 'object') extractTypes(val as Record<string, unknown>);
          });
        };
        extractTypes(json);
      } catch {
        // Malformed JSON-LD
        issues.push('Malformed JSON-LD structured data detected');
      }
    });

    if (structuredDataTypes.length === 0) {
      issues.push('No structured data (JSON-LD) found on homepage');
    }

    // Microdata schema types
    $('[itemtype]').each((_, el) => {
      const itemtype = (el as DomElement).attribs['itemtype'] || '';
      const match = itemtype.match(/schema\.org\/(\w+)/);
      if (match && !structuredDataTypes.includes(match[1])) {
        structuredDataTypes.push(match[1]);
      }
    });

    // Links
    $('a[href]').each((_, el) => {
      const href = (el as DomElement).attribs['href'] || '';
      if (href.startsWith('http') && !href.includes(domain)) {
        externalLinkCount++;
      } else if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        internalLinkCount++;
      }
    });

    // Images
    $('img').each((_, el) => {
      imageCount++;
      const alt = (el as DomElement).attribs['alt'];
      if (!alt || alt.trim() === '') imagesWithoutAlt++;
    });

    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} image(s) missing alt text`);
    }
  }

  // robots.txt
  let hasRobotsTxt = false;
  let robotsDisallowsAll = false;
  try {
    const robotsRes = await fetchWithTimeout(
      `${baseUrl}/robots.txt`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)' },
      },
      8000,
    );
    if (robotsRes.ok) {
      hasRobotsTxt = true;
      const robotsText = await robotsRes.text();

      // Check for blanket disallow
      const lines = robotsText.split('\n').map((l) => l.trim().toLowerCase());
      let inAsteriskSection = false;
      for (const line of lines) {
        if (line.startsWith('user-agent:')) {
          inAsteriskSection = line === 'user-agent: *' || line === 'user-agent:*';
        }
        if (inAsteriskSection && line === 'disallow: /') {
          robotsDisallowsAll = true;
          issues.push('robots.txt blocks all crawlers (Disallow: /)');
        }
      }

      // Extract sitemap from robots.txt
      const sitemapLine = lines.find((l) => l.startsWith('sitemap:'));
      if (sitemapLine) {
        // Sitemap mentioned in robots
      }
    } else {
      issues.push('No robots.txt found (404) — recommended for crawl guidance');
    }
  } catch {
    issues.push('Could not fetch robots.txt');
  }

  // sitemap.xml
  let hasSitemap = false;
  let sitemapUrl: string | null = null;
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap.xml.gz`,
  ];

  for (const candidate of sitemapCandidates) {
    try {
      const sitemapRes = await fetchWithTimeout(
        candidate,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)' },
        },
        8000,
      );
      if (sitemapRes.ok) {
        const contentType = sitemapRes.headers.get('content-type') || '';
        const body = await sitemapRes.text();
        if (
          contentType.includes('xml') ||
          body.trim().startsWith('<?xml') ||
          body.includes('<urlset') ||
          body.includes('<sitemapindex')
        ) {
          hasSitemap = true;
          sitemapUrl = candidate;

          // Check for URL count heuristic
          const urlMatches = body.match(/<url>/g);
          if (urlMatches && urlMatches.length > 0) {
            // Could estimate indexed pages from sitemap
          }
          break;
        }
      }
    } catch {
      // continue to next candidate
    }
  }

  if (!hasSitemap) {
    issues.push('No sitemap.xml found — submit a sitemap to improve crawlability');
  }

  // Estimate domain authority from on-page heuristics
  let authorityScore = 30; // baseline
  if (hasRobotsTxt && !robotsDisallowsAll) authorityScore += 5;
  if (hasSitemap) authorityScore += 5;
  if (structuredDataTypes.length > 0) authorityScore += 5;
  if (openGraphPresent) authorityScore += 3;
  if (twitterCardPresent) authorityScore += 2;
  if (canonicalUrl) authorityScore += 3;
  if (h1Tags.length === 1) authorityScore += 3;
  if (title && title.length >= 10 && title.length <= 60) authorityScore += 4;
  if (metaDescription && metaDescription.length >= 50 && metaDescription.length <= 160)
    authorityScore += 4;
  if (internalLinkCount > 20) authorityScore += 5;
  if (externalLinkCount > 5) authorityScore += 3;
  if (hasHreflang) authorityScore += 3;
  if (imagesWithoutAlt === 0 && imageCount > 0) authorityScore += 3;
  // Cap heuristic DA at 60 — real DA requires backlink data
  const estimatedDomainAuthority = clamp(authorityScore, 1, 60);

  return {
    title,
    metaDescription,
    h1Tags,
    canonicalUrl,
    structuredDataTypes,
    hasRobotsTxt,
    robotsDisallowsAll,
    hasSitemap,
    sitemapUrl,
    openGraphPresent,
    twitterCardPresent,
    crawlIssues: issues,
    estimatedDomainAuthority,
    internalLinkCount,
    externalLinkCount,
    imageCount,
    imagesWithoutAlt,
    pageLoadable,
    statusCode,
    isHttps: true, // we always fetch https://
    hasHreflang,
    viewportMetaPresent,
  };
}

// ─── Score Computation ────────────────────────────────────────────────────────

function computeSEOScore(
  crawl: CrawlResult,
  psi: PSIResult | null,
  dataForSeo: DataForSEOKeywordResult | null,
): { score: number; metrics: ScoredMetric[] } {
  const metrics: ScoredMetric[] = [];

  // 1. On-page SEO (30 pts)
  let onPageScore = 0;
  if (crawl.title && crawl.title.length >= 10 && crawl.title.length <= 60) onPageScore += 25;
  else if (crawl.title) onPageScore += 10;
  if (crawl.metaDescription && crawl.metaDescription.length >= 50 && crawl.metaDescription.length <= 160)
    onPageScore += 25;
  else if (crawl.metaDescription) onPageScore += 10;
  if (crawl.h1Tags.length === 1) onPageScore += 20;
  if (crawl.canonicalUrl) onPageScore += 15;
  if (crawl.openGraphPresent) onPageScore += 15;

  const onPageNormalized = clamp(onPageScore, 0, 100);
  metrics.push({
    label: 'On-page SEO',
    value: `${onPageNormalized}/100`,
    score: onPageNormalized,
    status: ragFromScore(onPageNormalized),
    source: 'crawl',
    explanation: 'Title, meta description, H1, canonical, Open Graph',
  });

  // 2. Crawlability (20 pts)
  let crawlScore = 0;
  if (crawl.hasRobotsTxt && !crawl.robotsDisallowsAll) crawlScore += 50;
  if (crawl.hasSitemap) crawlScore += 50;

  metrics.push({
    label: 'Crawlability',
    value: crawl.hasSitemap ? 'Sitemap present' : 'No sitemap',
    score: crawlScore,
    status: ragFromScore(crawlScore),
    source: 'crawl',
    explanation: 'robots.txt and sitemap.xml accessibility',
  });

  // 3. Structured Data (10 pts)
  const sdScore = crawl.structuredDataTypes.length >= 3
    ? 100
    : crawl.structuredDataTypes.length === 2
    ? 80
    : crawl.structuredDataTypes.length === 1
    ? 50
    : 0;

  metrics.push({
    label: 'Structured Data',
    value: crawl.structuredDataTypes.length > 0
      ? crawl.structuredDataTypes.join(', ')
      : 'None',
    score: sdScore,
    status: ragFromScore(sdScore),
    source: 'crawl',
    explanation: 'JSON-LD and schema.org markup types detected',
  });

  // 4. Core Web Vitals (25 pts from PSI)
  let cwvScore = 50; // default amber if no PSI data
  if (psi) {
    const lcpS = lcpStatus(psi.lcp);
    const clsS = clsStatus(psi.cls);
    const inpS = inpStatus(psi.inp);
    const ragToNum = (s: RAGStatus) => (s === 'green' ? 100 : s === 'amber' ? 60 : 20);
    cwvScore = Math.round((ragToNum(lcpS) + ragToNum(clsS) + ragToNum(inpS)) / 3);

    metrics.push({
      label: 'Largest Contentful Paint',
      value: `${(psi.lcp / 1000).toFixed(2)}s`,
      score: ragToNum(lcpS),
      status: lcpS,
      source: 'Google PSI',
      explanation: 'LCP < 2.5s = green, < 4s = amber, else red',
    });
    metrics.push({
      label: 'Cumulative Layout Shift',
      value: psi.cls.toFixed(3),
      score: ragToNum(clsS),
      status: clsS,
      source: 'Google PSI',
      explanation: 'CLS < 0.1 = green, < 0.25 = amber, else red',
    });
    metrics.push({
      label: 'Interaction to Next Paint',
      value: `${psi.inp}ms`,
      score: ragToNum(inpS),
      status: inpS,
      source: 'Google PSI',
      explanation: 'INP < 200ms = green, < 500ms = amber, else red',
    });
    metrics.push({
      label: 'Mobile Friendliness',
      value: psi.mobileFriendly ? 'Yes' : 'No',
      score: psi.mobileFriendly ? 100 : 0,
      status: psi.mobileFriendly ? 'green' : 'red',
      source: 'Google PSI',
    });
  } else {
    metrics.push({
      label: 'Core Web Vitals',
      value: 'No data',
      score: 50,
      status: 'amber',
      source: 'unavailable',
      explanation: 'Google PSI API key required for Core Web Vitals',
    });
  }

  // 5. Domain/Keyword Authority (15 pts from DataForSEO or heuristic)
  let authorityScore: number;
  let authoritySource: string;

  if (dataForSeo?.domainAuthority != null) {
    // Real DA: scale 0-100 directly
    authorityScore = clamp(dataForSeo.domainAuthority, 0, 100);
    authoritySource = 'DataForSEO';
  } else {
    // Use crawl-based heuristic (capped at 60)
    authorityScore = clamp(crawl.estimatedDomainAuthority * (100 / 60), 0, 100);
    authoritySource = 'crawl (heuristic)';
  }

  metrics.push({
    label: 'Domain Authority',
    value: dataForSeo?.domainAuthority != null
      ? dataForSeo.domainAuthority
      : `~${crawl.estimatedDomainAuthority} (est.)`,
    score: authorityScore,
    status: ragFromScore(authorityScore),
    source: authoritySource,
    explanation:
      dataForSeo?.domainAuthority != null
        ? 'Domain authority from DataForSEO'
        : 'Estimated from page structure heuristics (no DataForSEO key)',
  });

  // 6. Image Alt Text
  if (crawl.imageCount > 0) {
    const altScore = Math.round(
      ((crawl.imageCount - crawl.imagesWithoutAlt) / crawl.imageCount) * 100,
    );
    metrics.push({
      label: 'Image Alt Text Coverage',
      value: `${crawl.imageCount - crawl.imagesWithoutAlt}/${crawl.imageCount}`,
      score: altScore,
      status: ragFromScore(altScore),
      source: 'crawl',
      explanation: 'Images with descriptive alt attributes',
    });
  }

  // Weighted composite score
  const weights = {
    onPage: 0.25,
    crawlability: 0.15,
    structuredData: 0.10,
    cwv: 0.25,
    authority: 0.20,
    altText: 0.05,
  };

  const altTextScore =
    crawl.imageCount > 0
      ? Math.round(((crawl.imageCount - crawl.imagesWithoutAlt) / crawl.imageCount) * 100)
      : 80; // no images is neutral

  const compositeScore =
    onPageNormalized * weights.onPage +
    crawlScore * weights.crawlability +
    sdScore * weights.structuredData +
    cwvScore * weights.cwv +
    authorityScore * weights.authority +
    altTextScore * weights.altText;

  return { score: Math.round(clamp(compositeScore, 0, 100)), metrics };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function analyzeSEO(domain: string, config: APIConfig): Promise<SEOData> {
  // Run crawl and optional API calls in parallel where possible
  const crawlPromise = crawlDomain(domain);

  const psiPromise = hasKey(config, 'googlePsiKey')
    ? fetchPSI(domain, config.googlePsiKey)
    : Promise.resolve(null);

  const dataForSeoPromise =
    hasKey(config, 'dataForSeoLogin') && hasKey(config, 'dataForSeoPassword')
      ? fetchDataForSEO(domain, config.dataForSeoLogin, config.dataForSeoPassword)
      : Promise.resolve(null);

  const [crawl, psi, dataForSeo] = await Promise.all([
    crawlPromise,
    psiPromise,
    dataForSeoPromise,
  ]);

  // Core Web Vitals from PSI
  const coreWebVitals = psi
    ? {
        lcp: { value: psi.lcp, status: lcpStatus(psi.lcp) },
        inp: { value: psi.inp, status: inpStatus(psi.inp) },
        cls: { value: psi.cls, status: clsStatus(psi.cls) },
      }
    : null;

  // Mobile friendly: PSI is authoritative; fall back to viewport meta heuristic
  const mobileFriendly = psi != null ? psi.mobileFriendly : crawl.viewportMetaPresent;

  // Domain authority: prefer DataForSEO real value, fall back to heuristic
  const domainAuthority =
    dataForSeo?.domainAuthority ?? crawl.estimatedDomainAuthority;

  // Scores
  const { score, metrics } = computeSEOScore(crawl, psi, dataForSeo);

  return {
    domainAuthority,
    totalIndexedPages: null, // Requires Search Console or paid API; not available from crawl alone
    organicKeywordCount: dataForSeo?.organicKeywordCount ?? null,
    rankingDistribution: dataForSeo?.rankingDistribution ?? null,
    topKeywords: dataForSeo?.topKeywords ?? [],
    serpFeatures: dataForSeo?.serpFeatures ?? {
      featuredSnippets: false,
      peopleAlsoAsk: false,
      localPacks: false,
    },
    coreWebVitals,
    mobileFriendly,
    structuredData: crawl.structuredDataTypes,
    crawlIssues: crawl.crawlIssues,
    score,
    metrics,
  };
}
