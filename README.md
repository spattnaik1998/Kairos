# Kairos — Macro-Aware Probabilistic Portfolio Intelligence

> *καιρός — the right, critical moment*

**Kairos** is an AI-powered investment research platform built on [TimesFM 2.5](https://github.com/google-research/timesfm) — Google DeepMind's 200M-parameter decoder-only foundation model trained on 100 billion real-world time points.

Unlike traditional forecasting tools, Kairos provides **full probability distributions** over future asset prices, not just point estimates. Every forecast comes with calibrated 10th–90th percentile quantile bands, enabling institutional-grade risk quantification without Monte Carlo simulation.

---

## Platform Modules

### 📈 Asset Forecast
Probabilistic price forecasts for any equity, ETF, or index using TimesFM 2.5's zero-shot capability.

- Point forecast + 9 quantile bands (10th–90th percentile)
- Optional macro covariate augmentation via FRED API (CPI, yield curve, VIX, unemployment)
- Uses TimesFM's XReg pipeline: `xreg + timesfm` mode for residual fitting

### ⚡ Signal Engine
Ranked buy/sell signals across a curated universe of 20+ ETFs.

- **Confidence-adjusted expected return**: `signal_strength = expected_return × confidence`
- Confidence derived from quantile spread: tight band → high confidence → stronger signal
- Covers broad market, sectors, fixed income, commodities, and volatility

### 🛡️ Portfolio Risk
Institutional-grade VaR, CVaR, and scenario analysis — derived directly from TimesFM's quantile bands.

- **Value at Risk (VaR)** at 90%, 95%, or 99% confidence
- **Conditional VaR (Expected Shortfall)** — average loss beyond VaR
- **Simultaneous worst-case scenario**: all assets at their 10th percentile simultaneously
- Per-asset risk contribution breakdown
- Full portfolio return distribution chart

### 🕐 Temporal Pattern Library *(Signature Feature)*
Find historical market periods that most closely resemble the current environment — only possible because of TimesFM's **16,384-step context window**.

**How it works:**
1. Ingests the last N trading days of key market series: SPY, VIX, TLT (bonds), GLD (gold), HYG (credit)
2. Z-score normalises each series to capture *shape*, not level
3. Slides a window across 10 years of history, computing cosine similarity at each position
4. Returns top-N historical analogues with similarity scores and post-analogue outcomes
5. Shows what happened to SPX, bonds, and VIX in the 90 days following each match

```
Current market fingerprint → [GFC 2008 | COVID 2020 | Rate Hike 2022]
                                 82%          71%           68%
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      KAIROS                          │
│         Macro-Aware Probabilistic Intelligence       │
└─────────────────────────────────────────────────────┘
       │            │             │            │
 [Data Layer]  [Forecast]    [Signals]    [Risk]
  yfinance      TimesFM 2.5   Mean Rev.   VaR/CVaR
  FRED API      XReg Covars   Conf. Adj.  Stress Test
  DuckDB cache  Quantile FC   Cross-Asset Scenario

       └──────────────────────────────────────┘
                FastAPI Backend (Python 3.11)
                         │
              Next.js 14 + TypeScript Frontend
              TradingView Charts + Recharts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Foundation Model | TimesFM 2.5 (200M params, PyTorch) |
| Backend | Python 3.11, FastAPI, uvicorn |
| Data | yfinance, fredapi, pandas, numpy |
| Cache | DuckDB (embedded, zero-config) |
| ML Utilities | scikit-learn (XReg), scipy |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Charts | TradingView Lightweight Charts, Recharts |
| Infrastructure | Docker, docker-compose, GitHub Actions |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- A free [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html) (for macro data)

### 1. Clone and configure

```bash
git clone https://github.com/spattnaik1998/Kairos.git
cd Kairos

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and add your FRED_API_KEY
```

### 2. Install dependencies

```bash
make install
```

### 3. Run

```bash
make dev
# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Docker (alternative)

```bash
make docker-up
```

---

## API Reference

Full interactive docs at `http://localhost:8000/docs`

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/forecast` | POST | Probabilistic asset forecast |
| `/api/v1/signals` | GET | Ranked signal universe |
| `/api/v1/portfolio/risk` | POST | Portfolio VaR/CVaR |
| `/api/v1/patterns/analogues` | POST | Historical analogue search |
| `/api/v1/assets/{ticker}/history` | GET | OHLCV history |
| `/api/v1/assets/macro/snapshot` | GET | Live macro indicators |
| `/api/v1/assets/macro/{series_id}` | GET | FRED macro series |

---

## About TimesFM

TimesFM 2.5 is a **decoder-only transformer** pretrained by Google Research on 100 billion real-world time points from Google Trends, Wikipedia Pageviews, and public datasets. Key capabilities exploited in Kairos:

| Feature | TimesFM 2.5 Spec | Kairos Usage |
|---|---|---|
| Architecture | Decoder-only transformer, patch-based | Zero-shot asset forecasting |
| Context window | **16,384 timesteps** | Temporal Pattern Library (10-year lookback) |
| Quantile forecasting | 10th–90th percentile, 1k horizon | VaR/CVaR, uncertainty-weighted signals |
| Covariate support | Dynamic/static numerical & categorical | FRED macro augmentation via XReg |
| Parameters | 200M | Fast inference, CPU-friendly |
| Training data | 100 billion time points | Zero-shot generalisation to any asset |

---

## Project Structure

```
kairos/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # FastAPI route handlers
│   │   ├── core/                # Config, TimesFM model singleton
│   │   ├── services/            # Business logic
│   │   │   ├── market_data.py   # yfinance + FRED + DuckDB cache
│   │   │   ├── forecaster.py    # TimesFM forecast engine
│   │   │   ├── signals.py       # Signal generation
│   │   │   ├── risk.py          # Portfolio risk (VaR/CVaR)
│   │   │   └── patterns.py      # Temporal Pattern Library
│   │   └── schemas/             # Pydantic request/response models
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/                 # Next.js pages
│       │   ├── page.tsx         # Dashboard
│       │   ├── forecast/        # Asset Forecast
│       │   ├── signals/         # Signal Engine
│       │   ├── portfolio/       # Portfolio Risk
│       │   └── patterns/        # Temporal Pattern Library
│       ├── components/          # React components + charts
│       ├── lib/                 # API client, utilities
│       └── types/               # TypeScript interfaces
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Phase II Roadmap

- **LoRA Fine-tuning Pipeline** — domain-adapt TimesFM to specific asset classes
- **Backtesting Engine** — validate signal performance on historical data
- **Real-time Alerts** — webhook/email alerts when signals cross thresholds
- **Cross-asset Lead-Lag Chains** — commodity → FX → equity covariate chains

---

*Built with [TimesFM 2.5](https://github.com/google-research/timesfm) by Google Research · ICML 2024*
