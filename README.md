# LLM Company Research Tool

Analyse how a company appears in LLM-generated responses. Run simulations with diverse prompts, compute statistical metrics, and export results to Excel or view them in an interactive dashboard.

## What It Measures

| Metric | Description |
|--------|-------------|
| **Mention Rate** | How often the LLM mentions the company in relevant contexts |
| **Ranking Position** | Where the company appears in ranked/numbered lists |
| **Sentiment Score** | Whether language about the company is positive or negative (-1 to +1) |
| **Competitive Comparison** | How the company's visibility compares to named competitors |
| **Visibility Score** | Composite 0–100 score combining all metrics |

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# 3a. Launch the dashboard (recommended for non-technical users)
streamlit run app.py

# 3b. Or use the CLI
python run_research.py --company "Stripe" --industry "payments" \
    --competitors "Square,PayPal,Adyen" --simulations 20
```

## Dashboard

The Streamlit dashboard provides:
- One-click research setup via sidebar controls
- Real-time progress bar during simulations
- Interactive charts (visibility gauge, mention rates, sentiment distribution)
- Competitor comparison bar charts
- Detailed statistics tables
- One-click Excel report download

## Excel Report

The exported Excel file contains three sheets:
1. **Executive Summary** — KPIs, visibility score, competitor comparison
2. **Category Breakdown** — Per-category stats with embedded charts
3. **Raw Results** — Every simulation prompt, response, and metric

## Project Structure

```
├── app.py                 # Streamlit dashboard
├── run_research.py        # CLI runner
├── src/
│   ├── config.py          # Configuration dataclasses
│   ├── prompts.py         # Prompt templates by category
│   ├── engine.py          # LLM simulation engine
│   ├── analysis.py        # Statistical analysis
│   └── export.py          # Excel export with formatting & charts
├── requirements.txt
└── .env.example
```

## Prompt Categories

- **Product Recommendation** — "What companies would you recommend for X?"
- **Brand Perception** — "What do people think about Company?"
- **Industry Leadership** — "Who are the market leaders in X?"
- **Customer Sentiment** — "What do customers say about Company?"
- **Competitive Comparison** — "How does Company compare to Competitor?"
