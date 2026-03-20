#!/usr/bin/env python3
"""CLI runner for LLM Company Research Tool.

Usage:
    python run_research.py --company "Stripe" --industry "payments" \
        --competitors "Square,PayPal,Adyen" --simulations 20
"""

import argparse
import sys

from src.config import ResearchConfig
from src.engine import run_research
from src.analysis import compute_overall_stats
from src.export import export_to_excel


def main():
    parser = argparse.ArgumentParser(description="LLM Company Research Tool")
    parser.add_argument("--company", required=True, help="Company name to research")
    parser.add_argument("--industry", default="", help="Industry / sector")
    parser.add_argument("--competitors", default="", help="Comma-separated competitor names")
    parser.add_argument("--simulations", type=int, default=20, help="Number of simulations (default: 20)")
    parser.add_argument("--model", default="claude-sonnet-4-6", help="Claude model to use")
    parser.add_argument("--output-dir", default="output", help="Output directory")
    args = parser.parse_args()

    competitors = [c.strip() for c in args.competitors.split(",") if c.strip()]

    config = ResearchConfig(
        company_name=args.company,
        industry=args.industry,
        competitors=competitors,
        num_simulations=args.simulations,
        model=args.model,
    )

    print(f"Researching: {args.company}")
    print(f"Industry: {args.industry or '(not specified)'}")
    print(f"Competitors: {', '.join(competitors) or '(none)'}")
    print(f"Simulations: {args.simulations}")
    print(f"Model: {args.model}")
    print("-" * 50)

    def progress(current, total, msg):
        pct = current / total * 100
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        print(f"\r  [{bar}] {pct:.0f}%  {msg}", end="", flush=True)

    results = run_research(config, progress_callback=progress)
    print()

    stats = compute_overall_stats(args.company, results, competitors)

    print("\n" + "=" * 50)
    print(f"  RESULTS — {stats.company}")
    print("=" * 50)
    print(f"  Visibility Score:   {stats.visibility_score:.1f} / 100")
    print(f"  Mention Rate:       {stats.overall_mention_rate:.1%}")
    print(f"  Avg Sentiment:      {stats.overall_avg_sentiment:+.3f}")
    print(f"  Avg Rank Position:  {stats.overall_avg_position or 'N/A'}")
    print()

    if stats.competitor_summary:
        print("  Competitor Mention Rates:")
        for comp, rate in stats.competitor_summary.items():
            print(f"    {comp:<20s} {rate:.1%}")
        print()

    print("  Category Breakdown:")
    for cs in stats.category_stats:
        name = cs.category.replace("_", " ").title()
        print(f"    {name:<25s}  mention={cs.mention_rate:.0%}  sentiment={cs.avg_sentiment:+.3f}")
    print()

    excel_path = export_to_excel(results, stats, output_dir=args.output_dir)
    print(f"  Excel report saved: {excel_path}")
    print("=" * 50)


if __name__ == "__main__":
    main()
