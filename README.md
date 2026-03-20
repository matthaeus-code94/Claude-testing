# Digital Due Diligence & GEO Intelligence Platform

A professional-grade digital due diligence tool for analyzing companies whose primary GTM channel is online. Built to the analytical standards of a top-tier strategy consulting engagement.

## Modules

| # | Module | Key Outputs |
|---|--------|-------------|
| 1 | **Traffic Intelligence** | Monthly visits, source mix, geo distribution, device split, anomaly flags |
| 2 | **SEO Health** | Domain authority, Core Web Vitals, keyword rankings, structured data, crawl issues |
| 3 | **GEO Engine** | AI mention frequency, citation rates, E-E-A-T signals, knowledge graph, GEO score 0-100 |
| 4 | **Tech Stack** | Technology detection, Lighthouse scores, security posture, tech debt signals |
| 5 | **Competitive** | Auto-competitor ID, share of voice, whitespace keywords, side-by-side benchmarking |
| 6 | **Strategic Scorecard** | Digital Health Score, strengths/risks/opportunities, management questions, 100-day priorities |

## Quick Start

```bash
# Install dependencies
npm install

# Configure API keys (at minimum, ANTHROPIC_API_KEY)
cp .env.example .env.local
# Edit .env.local with your keys

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a target domain.

## API Keys & Data Sourcing

The tool uses a **fallback chain** for data sourcing:

| Priority | Source | Cost | Coverage |
|----------|--------|------|----------|
| 1 | Paid APIs (SimilarWeb, DataForSEO) | Paid | Most accurate |
| 2 | Free APIs (Google PSI) | Free | Always available |
| 3 | Crawl + heuristics (fetch + cheerio) | Free | Always available |
| 4 | LLM inference (Claude/GPT) | API costs | Intelligent estimates |

**Minimum requirement:** Set `ANTHROPIC_API_KEY` for GEO module and scorecard generation.

**For richer analysis**, add:
- `GOOGLE_PSI_API_KEY` — Free, provides real Lighthouse scores and Core Web Vitals
- `OPENAI_API_KEY` — Enables GPT-4o queries in GEO module
- `PERPLEXITY_API_KEY` — Enables Perplexity Sonar Pro queries in GEO module

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Main dashboard (client component)
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Design system tokens
│   └── api/analyze/route.ts      # Analysis API endpoint
├── lib/
│   ├── utils.ts                  # Shared utilities
│   ├── api-config.ts             # API key management
│   └── modules/
│       ├── traffic.ts            # Module 1: Traffic Intelligence
│       ├── seo.ts                # Module 2: SEO Health
│       ├── geo.ts                # Module 3: GEO Engine (core differentiator)
│       ├── techstack.ts          # Module 4: Tech Stack Assessment
│       ├── competitive.ts        # Module 5: Competitive Benchmarking
│       └── scorecard.ts          # Module 6: Strategic Scorecard
├── components/
│   ├── ui/                       # RAGBadge, MetricCard, ScoreGauge, etc.
│   ├── charts/                   # SpiderChart, BarChart, DonutChart
│   └── modules/                  # Panel components for each module
└── types/
    └── index.ts                  # Full TypeScript type definitions
```

Each module runs independently and in parallel. Errors in one module don't crash others — the dashboard shows "data unavailable" gracefully.

## GEO Module — Differentiator

The GEO (Generative Engine Optimization) module is the forward-looking AI-readiness assessment:

1. **Query Generation** — Infers buyer queries from company/industry
2. **AI Answer Harvesting** — Queries Claude, GPT-4o, Perplexity in parallel
3. **Brand Signal Extraction** — Parses mentions, citations, sentiment
4. **Site Readiness Scan** — Checks FAQ content, schema markup, E-E-A-T signals
5. **Knowledge Graph Check** — Wikidata entity lookup
6. **Scoring** — 6-dimension weighted score (0-100)
7. **Recommendations** — Auto-generated prioritized action items

## Export

- **PDF**: Click "Export PDF" to print the dashboard (optimized for print)
- All data visible in the dashboard with RAG (Red/Amber/Green) status indicators

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **Charts**: Recharts (radar, bar, donut)
- **Backend**: Next.js API routes
- **Crawling**: fetch + cheerio for on-page analysis
- **AI**: Anthropic, OpenAI, and Perplexity APIs for GEO analysis
