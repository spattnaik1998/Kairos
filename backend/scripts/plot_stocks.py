"""
Plot historical stock prices for key tickers in the Kairos universe.

Run from the backend directory:
    python scripts/plot_stocks.py
"""

import sys
from datetime import datetime, timedelta

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import yfinance as yf

TICKERS = ["SPY", "QQQ", "GLD", "TLT", "IWM", "XLK"]
YEARS = 5

end = datetime.today()
start = end - timedelta(days=YEARS * 365)

print(f"Downloading {YEARS}Y of data for: {', '.join(TICKERS)} ...")
raw = yf.download(TICKERS, start=start, end=end, auto_adjust=True, progress=False)

# yfinance returns MultiIndex columns when multiple tickers are requested
if hasattr(raw.columns, "levels"):
    closes = raw["Close"]
else:
    closes = raw[["Close"]]

closes = closes.dropna(how="all")
if closes.empty:
    print("ERROR: No data returned. Check your internet connection and yfinance version.")
    sys.exit(1)

# Normalise to 100 at the first available date for relative comparison
normalized = (closes / closes.iloc[0]) * 100

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10), sharex=True)
fig.suptitle(
    f"Kairos Universe — Historical Prices  ({start.strftime('%b %Y')} → {end.strftime('%b %Y')})",
    fontsize=14,
    fontweight="bold",
)

colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]

# ── Top panel: normalised growth (base = 100) ────────────────────────────────
for i, ticker in enumerate(TICKERS):
    if ticker in normalized.columns:
        ax1.plot(
            normalized.index,
            normalized[ticker],
            label=ticker,
            linewidth=1.6,
            color=colors[i % len(colors)],
        )

ax1.axhline(100, color="black", linewidth=0.8, linestyle="--", alpha=0.4)
ax1.set_title("Normalised Performance  (100 = start)", fontsize=11)
ax1.set_ylabel("Indexed Price")
ax1.legend(loc="upper left", ncol=3, fontsize=9)
ax1.grid(True, alpha=0.25)

# ── Bottom panel: absolute USD prices ────────────────────────────────────────
bottom_tickers = ["SPY", "QQQ", "GLD", "TLT"]
for i, ticker in enumerate(bottom_tickers):
    if ticker in closes.columns:
        ax2.plot(
            closes.index,
            closes[ticker],
            label=ticker,
            linewidth=1.6,
            color=colors[i % len(colors)],
        )

ax2.set_title("Absolute Price Levels (USD)", fontsize=11)
ax2.set_ylabel("Price (USD)")
ax2.legend(loc="upper left", ncol=2, fontsize=9)
ax2.grid(True, alpha=0.25)
ax2.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
ax2.xaxis.set_major_locator(mdates.YearLocator())

plt.tight_layout()
out = "stock_prices.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
print(f"Plot saved → {out}")
plt.show()
