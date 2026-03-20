"""Streamlit dashboard — LLM Company Research Tool.

Run with:  streamlit run app.py
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from src.config import ResearchConfig
from src.engine import run_research, SimulationResult
from src.analysis import compute_overall_stats, OverallStats
from src.export import export_to_excel

# ─── Page config ───
st.set_page_config(
    page_title="LLM Company Research Tool",
    page_icon="🔍",
    layout="wide",
)

# ─── Custom CSS ───
st.markdown("""
<style>
    .big-number { font-size: 2.5rem; font-weight: 700; color: #2F5496; }
    .metric-label { font-size: 0.9rem; color: #666; }
    .stProgress > div > div > div > div { background-color: #2F5496; }
</style>
""", unsafe_allow_html=True)

# ─── Sidebar: Research Setup ───
st.sidebar.title("Research Setup")

company_name = st.sidebar.text_input("Company Name", placeholder="e.g. Stripe")
industry = st.sidebar.text_input("Industry / Sector", placeholder="e.g. payments processing")
website_url = st.sidebar.text_input("Website URL (optional)", placeholder="e.g. https://stripe.com")

competitors_raw = st.sidebar.text_area(
    "Competitors (one per line)",
    placeholder="e.g.\nSquare\nAdyen\nPayPal",
)
competitors = [c.strip() for c in competitors_raw.strip().splitlines() if c.strip()]

st.sidebar.markdown("---")
st.sidebar.subheader("Simulation Settings")

num_simulations = st.sidebar.slider("Number of simulations", 5, 100, 20, step=5)

categories = st.sidebar.multiselect(
    "Prompt categories",
    options=[
        "product_recommendation",
        "brand_perception",
        "industry_leadership",
        "customer_sentiment",
        "competitive_comparison",
    ],
    default=[
        "product_recommendation",
        "brand_perception",
        "industry_leadership",
        "customer_sentiment",
        "competitive_comparison",
    ],
    format_func=lambda x: x.replace("_", " ").title(),
)

model = st.sidebar.selectbox(
    "Model",
    ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    index=0,
)

# ─── Main area ───
st.title("LLM Company Research Tool")
st.markdown("Analyse how a company appears in LLM-generated responses. "
            "Run simulations, view statistics, and export results to Excel.")

# State management
if "results" not in st.session_state:
    st.session_state.results = None
    st.session_state.stats = None
    st.session_state.excel_path = None

run_btn = st.sidebar.button("Run Research", type="primary", use_container_width=True)

if run_btn:
    if not company_name:
        st.error("Please enter a company name.")
    else:
        config = ResearchConfig(
            company_name=company_name,
            industry=industry,
            competitors=competitors,
            website_url=website_url,
            num_simulations=num_simulations,
            prompt_categories=categories,
            model=model,
        )

        progress_bar = st.progress(0, text="Starting simulations...")

        def update_progress(current, total, msg):
            progress_bar.progress(current / total, text=msg)

        with st.spinner("Running LLM simulations..."):
            results = run_research(config, progress_callback=update_progress)

        progress_bar.progress(1.0, text="Done!")

        stats = compute_overall_stats(company_name, results, competitors)
        excel_path = export_to_excel(results, stats)

        st.session_state.results = results
        st.session_state.stats = stats
        st.session_state.excel_path = excel_path
        st.rerun()


def render_dashboard(results: list[SimulationResult], stats: OverallStats):
    """Render the full results dashboard."""

    # ── KPI row ──
    st.markdown("## Key Metrics")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Visibility Score", f"{stats.visibility_score:.1f}/100")
    with col2:
        st.metric("Mention Rate", f"{stats.overall_mention_rate:.0%}")
    with col3:
        st.metric("Avg Sentiment", f"{stats.overall_avg_sentiment:+.2f}")
    with col4:
        st.metric("Avg Rank Position", stats.overall_avg_position or "N/A")

    st.markdown("---")

    # ── Visibility gauge ──
    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.markdown("### LLM Visibility Score")
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=stats.visibility_score,
            domain={"x": [0, 1], "y": [0, 1]},
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": "#2F5496"},
                "steps": [
                    {"range": [0, 33], "color": "#FFC7CE"},
                    {"range": [33, 66], "color": "#FFEB9C"},
                    {"range": [66, 100], "color": "#C6EFCE"},
                ],
            },
            title={"text": stats.company},
        ))
        fig_gauge.update_layout(height=300, margin=dict(t=50, b=0, l=30, r=30))
        st.plotly_chart(fig_gauge, use_container_width=True)

    with col_right:
        st.markdown("### Mention Rate by Category")
        cat_df = pd.DataFrame([
            {
                "Category": cs.category.replace("_", " ").title(),
                "Mention Rate": cs.mention_rate,
                "Avg Sentiment": cs.avg_sentiment,
            }
            for cs in stats.category_stats
        ])
        fig_bar = px.bar(
            cat_df, x="Category", y="Mention Rate",
            color="Avg Sentiment",
            color_continuous_scale="RdYlGn",
            range_color=[-1, 1],
            text_auto=".0%",
        )
        fig_bar.update_layout(height=300, margin=dict(t=30, b=0))
        st.plotly_chart(fig_bar, use_container_width=True)

    st.markdown("---")

    # ── Competitor comparison ──
    if stats.competitor_summary:
        st.markdown("### Company vs Competitors — Mention Rates")
        comp_data = [{"Company": f"{stats.company} (target)", "Mention Rate": stats.overall_mention_rate}]
        for comp, rate in stats.competitor_summary.items():
            comp_data.append({"Company": comp, "Mention Rate": rate})
        comp_df = pd.DataFrame(comp_data)

        fig_comp = px.bar(
            comp_df, x="Company", y="Mention Rate",
            color="Company",
            text_auto=".0%",
        )
        fig_comp.update_layout(height=350, showlegend=False, margin=dict(t=30, b=0))
        st.plotly_chart(fig_comp, use_container_width=True)

        st.markdown("---")

    # ── Sentiment distribution ──
    st.markdown("### Sentiment Distribution Across Simulations")
    sent_df = pd.DataFrame([
        {
            "Category": r.category.replace("_", " ").title(),
            "Sentiment": r.sentiment_score,
            "Mentioned": "Yes" if r.company_mentioned else "No",
        }
        for r in results
    ])
    fig_sent = px.histogram(
        sent_df, x="Sentiment", color="Category",
        nbins=20, barmode="overlay", opacity=0.7,
    )
    fig_sent.update_layout(height=300, margin=dict(t=30, b=0))
    st.plotly_chart(fig_sent, use_container_width=True)

    st.markdown("---")

    # ── Category detail table ──
    st.markdown("### Detailed Category Statistics")
    detail_data = []
    for cs in stats.category_stats:
        row = {
            "Category": cs.category.replace("_", " ").title(),
            "Runs": cs.total_runs,
            "Mentions": cs.mention_count,
            "Mention Rate": f"{cs.mention_rate:.1%}",
            "Avg Position": cs.avg_position or "—",
            "Avg Sentiment": f"{cs.avg_sentiment:+.3f}",
            "Sentiment Std": f"{cs.sentiment_std:.3f}",
        }
        detail_data.append(row)
    st.dataframe(pd.DataFrame(detail_data), use_container_width=True, hide_index=True)

    # ── Raw results expander ──
    with st.expander("View Raw Simulation Results"):
        raw_data = []
        for i, r in enumerate(results, 1):
            raw_data.append({
                "#": i,
                "Category": r.category.replace("_", " ").title(),
                "Prompt": r.prompt[:100],
                "Mentioned": "Yes" if r.company_mentioned else "No",
                "Position": r.mention_position or "—",
                "Sentiment": f"{r.sentiment_score:+.3f}",
                "Response": r.response[:200] + "...",
                "Latency (ms)": r.latency_ms,
            })
        st.dataframe(pd.DataFrame(raw_data), use_container_width=True, hide_index=True)


# ── Render dashboard or welcome ──
if st.session_state.results is not None:
    render_dashboard(st.session_state.results, st.session_state.stats)

    # Excel download button
    st.sidebar.markdown("---")
    st.sidebar.subheader("Export")
    if st.session_state.excel_path:
        with open(st.session_state.excel_path, "rb") as f:
            st.sidebar.download_button(
                label="Download Excel Report",
                data=f,
                file_name=st.session_state.excel_path.split("/")[-1],
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
else:
    st.info("Configure your research parameters in the sidebar and click **Run Research** to begin.")
    st.markdown("""
    ### How It Works
    1. **Enter a company name** and optional industry, competitors, and website
    2. **Configure simulation settings** — number of runs, prompt categories, model
    3. **Click Run Research** — the tool sends diverse prompts to an LLM and analyses responses
    4. **View results** in the interactive dashboard or **download the Excel report**

    ### What It Measures
    - **Mention Rate** — How often the LLM mentions the company in relevant contexts
    - **Ranking Position** — Where the company appears in ranked lists
    - **Sentiment Score** — Whether the LLM's language about the company is positive or negative
    - **Competitive Comparison** — How the company's visibility compares to competitors
    - **Visibility Score** — A composite 0–100 score combining all metrics
    """)
