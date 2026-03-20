"""Core research engine — runs LLM simulations and parses results."""

import time
import re
from dataclasses import dataclass, field
from anthropic import Anthropic

from .config import ResearchConfig
from .prompts import build_prompt, get_all_prompts


@dataclass
class SimulationResult:
    """Single simulation result."""

    category: str
    prompt: str
    response: str
    company_mentioned: bool
    mention_position: int | None  # position in list if ranked (1-based)
    sentiment_score: float  # -1 to 1
    competitor_mentions: dict[str, bool] = field(default_factory=dict)
    latency_ms: float = 0.0


def _analyse_response(response: str, company: str,
                       competitors: list[str]) -> tuple[bool, int | None, float, dict[str, bool]]:
    """Parse an LLM response for mention, ranking position, sentiment, and competitor mentions."""
    text = response.lower()
    company_lower = company.lower()

    # --- Mentioned at all? ---
    mentioned = company_lower in text

    # --- Ranking position ---
    position = None
    # Look for numbered lists like "1. CompanyName" or "1) CompanyName"
    pattern = r'(\d+)[.\)]\s*\*{0,2}' + re.escape(company_lower)
    match = re.search(pattern, text)
    if match:
        position = int(match.group(1))

    # --- Simple sentiment heuristic ---
    positive_words = [
        "excellent", "great", "innovative", "leading", "best", "top",
        "recommend", "trusted", "reliable", "strong", "impressive",
        "outstanding", "superior", "popular", "growing",
    ]
    negative_words = [
        "poor", "weak", "declining", "controversial", "struggling",
        "complaints", "expensive", "limited", "outdated", "concerns",
        "issues", "problems", "criticized", "behind", "lacking",
    ]
    # Only count sentiment words near the company mention
    window = 300
    idx = text.find(company_lower)
    if idx >= 0:
        snippet = text[max(0, idx - window): idx + window]
    else:
        snippet = text  # fall back to full text

    pos_count = sum(1 for w in positive_words if w in snippet)
    neg_count = sum(1 for w in negative_words if w in snippet)
    total = pos_count + neg_count
    sentiment = (pos_count - neg_count) / total if total > 0 else 0.0

    # --- Competitor mentions ---
    comp_mentions = {c: c.lower() in text for c in competitors}

    return mentioned, position, sentiment, comp_mentions


def run_simulation(client: Anthropic, config: ResearchConfig,
                   category: str, prompt_text: str) -> SimulationResult:
    """Run a single LLM simulation."""
    start = time.time()
    message = client.messages.create(
        model=config.model,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
        messages=[{"role": "user", "content": prompt_text}],
    )
    latency = (time.time() - start) * 1000
    response_text = message.content[0].text

    mentioned, position, sentiment, comp_mentions = _analyse_response(
        response_text, config.company_name, config.competitors
    )

    return SimulationResult(
        category=category,
        prompt=prompt_text,
        response=response_text,
        company_mentioned=mentioned,
        mention_position=position,
        sentiment_score=round(sentiment, 3),
        competitor_mentions=comp_mentions,
        latency_ms=round(latency, 1),
    )


def run_research(config: ResearchConfig,
                 progress_callback=None) -> list[SimulationResult]:
    """Run the full research simulation suite.

    Args:
        config: Research configuration.
        progress_callback: Optional callable(current, total, message) for UI updates.
    """
    client = Anthropic()
    results: list[SimulationResult] = []

    # Build the full prompt list upfront so we know total count
    prompt_plan: list[tuple[str, str]] = []  # (category, prompt_text)
    for category in config.prompt_categories:
        all_prompts = get_all_prompts(
            category,
            config.company_name,
            config.industry,
            config.competitors[0] if config.competitors else "",
        )
        sims_per_category = max(1, config.num_simulations // len(config.prompt_categories))
        # Cycle through prompts to reach desired count
        for i in range(sims_per_category):
            prompt_text = all_prompts[i % len(all_prompts)]
            prompt_plan.append((category, prompt_text))

    total = len(prompt_plan)
    for idx, (category, prompt_text) in enumerate(prompt_plan, 1):
        if progress_callback:
            progress_callback(idx, total, f"Running: {category} ({idx}/{total})")
        result = run_simulation(client, config, category, prompt_text)
        results.append(result)

    return results
