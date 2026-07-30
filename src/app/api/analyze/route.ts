import { NextRequest, NextResponse } from 'next/server';
import { getAPIConfig } from '@/lib/api-config';
import { extractDomain } from '@/lib/utils';
import { analyzeTraffic } from '@/lib/modules/traffic';
import { analyzeSEO } from '@/lib/modules/seo';
import { analyzeGEO } from '@/lib/modules/geo';
import { analyzeTechStack } from '@/lib/modules/techstack';
import { analyzeCompetitive } from '@/lib/modules/competitive';
import { generateScorecard } from '@/lib/modules/scorecard';
import { TokenTracker } from '@/lib/token-tracker';
import type { AnalysisResult } from '@/types';

export const maxDuration = 120; // Allow up to 2 min for full analysis

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain: rawDomain, companyName, industry, competitors } = body;

    if (!rawDomain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const domain = extractDomain(rawDomain);
    const config = getAPIConfig();
    const name = companyName || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    const tracker = new TokenTracker();

    // Run modules in parallel where possible
    const [trafficResult, seoResult, geoResult, techResult] = await Promise.allSettled([
      analyzeTraffic(domain, config),
      analyzeSEO(domain, config),
      analyzeGEO(domain, name, industry || '', competitors || [], config, tracker),
      analyzeTechStack(domain, config),
    ]);

    const traffic = trafficResult.status === 'fulfilled' ? trafficResult.value : null;
    const seo = seoResult.status === 'fulfilled' ? seoResult.value : null;
    const geo = geoResult.status === 'fulfilled' ? geoResult.value : null;
    const techStack = techResult.status === 'fulfilled' ? techResult.value : null;

    // Competitive needs some prior results context
    let competitive = null;
    try {
      competitive = await analyzeCompetitive(domain, name, industry || '', competitors || [], config, tracker);
    } catch { /* graceful degradation */ }

    // Scorecard synthesizes everything
    let scorecard = null;
    try {
      scorecard = await generateScorecard(name, { traffic, seo, geo, techStack, competitive }, config, tracker);
    } catch { /* graceful degradation */ }

    const tokenUsage = tracker.getSummary();

    const result: AnalysisResult = {
      domain,
      companyName: name,
      analyzedAt: new Date().toISOString(),
      status: 'completed',
      progress: {
        traffic: traffic ? 'done' : 'error',
        seo: seo ? 'done' : 'error',
        geo: geo ? 'done' : 'error',
        techStack: techStack ? 'done' : 'error',
        competitive: competitive ? 'done' : 'error',
        scorecard: scorecard ? 'done' : 'error',
      },
      traffic,
      seo,
      geo,
      techStack,
      competitive,
      scorecard,
      tokenUsage: tokenUsage.totalTokens > 0 ? tokenUsage : null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: String(error) },
      { status: 500 }
    );
  }
}
