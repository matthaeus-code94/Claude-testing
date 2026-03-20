"""Prompt templates for LLM company research simulations."""

PROMPT_TEMPLATES: dict[str, list[str]] = {
    "product_recommendation": [
        "I'm looking for a good {industry} solution. What companies would you recommend?",
        "What are the top {industry} providers I should consider?",
        "Can you suggest the best {industry} companies for a mid-size business?",
        "I need to choose a {industry} vendor. Who are the leaders in this space?",
        "What {industry} tools or services do experts recommend most?",
    ],
    "brand_perception": [
        "What do people generally think about {company}?",
        "Is {company} a reputable company? What's their reputation like?",
        "How is {company} perceived in the {industry} market?",
        "What are the pros and cons of working with {company}?",
        "Would you say {company} is a trustworthy brand? Why or why not?",
    ],
    "industry_leadership": [
        "Who are the market leaders in {industry}?",
        "Which companies are considered innovators in {industry}?",
        "What companies are disrupting the {industry} space right now?",
        "Who dominates the {industry} market and why?",
        "Name the top 5 companies in {industry} and explain their strengths.",
    ],
    "customer_sentiment": [
        "What do customers typically say about {company}'s products or services?",
        "Are {company}'s customers generally satisfied? What are common complaints?",
        "How does {company} handle customer support and service?",
        "What's the word of mouth like for {company}?",
        "If I were to read reviews of {company}, what themes would I see?",
    ],
    "competitive_comparison": [
        "How does {company} compare to {competitor} in {industry}?",
        "What advantages does {company} have over {competitor}?",
        "If I had to choose between {company} and {competitor}, which is better and why?",
        "Compare {company} and {competitor} in terms of pricing, quality, and innovation.",
        "{company} vs {competitor}: which one would you recommend for {industry}?",
    ],
}


def build_prompt(category: str, company: str, industry: str,
                 competitor: str = "") -> str:
    """Select a random prompt from the category and fill in variables."""
    import random
    templates = PROMPT_TEMPLATES.get(category, PROMPT_TEMPLATES["brand_perception"])
    template = random.choice(templates)
    return template.format(
        company=company,
        industry=industry or "technology",
        competitor=competitor or "competitors",
    )


def get_all_prompts(category: str, company: str, industry: str,
                    competitor: str = "") -> list[str]:
    """Return all prompts for a category with variables filled in."""
    templates = PROMPT_TEMPLATES.get(category, [])
    return [
        t.format(
            company=company,
            industry=industry or "technology",
            competitor=competitor or "competitors",
        )
        for t in templates
    ]
