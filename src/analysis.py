"""Statistical analysis of simulation results."""

from dataclasses import dataclass
from .engine import SimulationResult


@dataclass
class CategoryStats:
    """Aggregated stats for one prompt category."""

    category: str
    total_runs: int
    mention_count: int
    mention_rate: float  # 0-1
    avg_position: float | None
    avg_sentiment: float
    sentiment_std: float
    competitor_mention_rates: dict[str, float]


@dataclass
class OverallStats:
    """Top-level research summary."""

    company: str
    total_simulations: int
    overall_mention_rate: float
    overall_avg_sentiment: float
    overall_avg_position: float | None
    category_stats: list[CategoryStats]
    competitor_summary: dict[str, float]  # competitor -> overall mention rate
    visibility_score: float  # 0-100 composite score


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return variance ** 0.5


def compute_category_stats(category: str,
                           results: list[SimulationResult],
                           competitors: list[str]) -> CategoryStats:
    """Compute stats for a single category."""
    total = len(results)
    if total == 0:
        return CategoryStats(category, 0, 0, 0.0, None, 0.0, 0.0, {})

    mentions = [r for r in results if r.company_mentioned]
    mention_rate = len(mentions) / total

    positions = [r.mention_position for r in results if r.mention_position is not None]
    avg_pos = sum(positions) / len(positions) if positions else None

    sentiments = [r.sentiment_score for r in results]
    avg_sent = sum(sentiments) / len(sentiments)
    sent_std = _std(sentiments)

    comp_rates = {}
    for c in competitors:
        comp_count = sum(1 for r in results if r.competitor_mentions.get(c, False))
        comp_rates[c] = comp_count / total

    return CategoryStats(
        category=category,
        total_runs=total,
        mention_count=len(mentions),
        mention_rate=round(mention_rate, 3),
        avg_position=round(avg_pos, 2) if avg_pos else None,
        avg_sentiment=round(avg_sent, 3),
        sentiment_std=round(sent_std, 3),
        competitor_mention_rates={k: round(v, 3) for k, v in comp_rates.items()},
    )


def compute_overall_stats(company: str,
                          results: list[SimulationResult],
                          competitors: list[str]) -> OverallStats:
    """Compute aggregate statistics across all categories."""
    total = len(results)
    if total == 0:
        return OverallStats(company, 0, 0.0, 0.0, None, [], {}, 0.0)

    # Group by category
    categories: dict[str, list[SimulationResult]] = {}
    for r in results:
        categories.setdefault(r.category, []).append(r)

    cat_stats = [
        compute_category_stats(cat, cat_results, competitors)
        for cat, cat_results in categories.items()
    ]

    mention_rate = sum(1 for r in results if r.company_mentioned) / total
    sentiments = [r.sentiment_score for r in results]
    avg_sentiment = sum(sentiments) / len(sentiments)

    positions = [r.mention_position for r in results if r.mention_position is not None]
    avg_pos = sum(positions) / len(positions) if positions else None

    comp_summary = {}
    for c in competitors:
        comp_count = sum(1 for r in results if r.competitor_mentions.get(c, False))
        comp_summary[c] = round(comp_count / total, 3)

    # Composite visibility score (0-100)
    # Weighted: 40% mention rate, 30% sentiment, 20% ranking, 10% vs competitors
    mention_score = mention_rate * 40
    sentiment_score = ((avg_sentiment + 1) / 2) * 30  # normalise -1..1 to 0..1
    if avg_pos is not None:
        rank_score = max(0, (10 - avg_pos) / 9) * 20  # rank 1 = 20, rank 10 = 0
    else:
        rank_score = 0
    # Competitor edge: how often company is mentioned more than average competitor
    if comp_summary:
        avg_comp_rate = sum(comp_summary.values()) / len(comp_summary)
        edge = min(1.0, max(0.0, (mention_rate - avg_comp_rate + 0.5)))
        comp_score = edge * 10
    else:
        comp_score = 5  # neutral if no competitors

    visibility = round(mention_score + sentiment_score + rank_score + comp_score, 1)

    return OverallStats(
        company=company,
        total_simulations=total,
        overall_mention_rate=round(mention_rate, 3),
        overall_avg_sentiment=round(avg_sentiment, 3),
        overall_avg_position=round(avg_pos, 2) if avg_pos else None,
        category_stats=cat_stats,
        competitor_summary=comp_summary,
        visibility_score=min(100.0, max(0.0, visibility)),
    )
