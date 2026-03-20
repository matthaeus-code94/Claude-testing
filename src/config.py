"""Configuration and settings for the LLM Company Research Tool."""

import os
from dataclasses import dataclass, field


@dataclass
class ResearchConfig:
    """Configuration for a research run."""

    company_name: str
    industry: str = ""
    competitors: list[str] = field(default_factory=list)
    website_url: str = ""
    num_simulations: int = 20
    prompt_categories: list[str] = field(default_factory=lambda: [
        "product_recommendation",
        "brand_perception",
        "industry_leadership",
        "customer_sentiment",
        "competitive_comparison",
    ])
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 1024
    temperature: float = 1.0  # Higher temp = more variation across runs


@dataclass
class AppConfig:
    """Global application configuration."""

    anthropic_api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    output_dir: str = "output"
    default_simulations: int = 20
