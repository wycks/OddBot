# OddBot — Strategy Backtesting Visualizer

A moving average crossover **backtesting** tool. Tweak a parameter on the frontend, and the backend instantly simulates the strategy against historical Yahoo Finance data and plots the results.

![OddBot screenshot](example.jpg)

---

## Quick Start

### Prerequisites

- **Python 3.13** with `venv`
- **Node.js** with `npm`
- **Docker** — for Redis caching (optional, falls back to in-memory cache)

### 1. Backend Setup

```sh
# Create and activate virtual environment (if not already done)
python -m venv backend\venv
backend\venv\Scripts\Activate.ps1

# Install dependencies
pip install fastapi uvicorn websockets vectorbt numpy pandas msgpack redis yfinance
```

### 2. Start Redis (optional but recommended)

```sh
docker run -d --name local-redis -p 6379:6379 redis:latest
```
Or if already created:
```sh
docker start local-redis
```

### 3. Start the Backend

```sh
backend\venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start the Frontend

```sh
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Configuration

Edit `backend/config.json` to change the market data source without touching any code:

```json
{
    "symbol": "BTC-USD",
    "period": "1y",
    "interval": "1h"
}
```

| Field | Examples | Notes |
|---|---|---|
| `symbol` | `BTC-USD`, `ETH-USD`, `AAPL`, `SPY`, `EURUSD=X` | Any Yahoo Finance ticker |
| `period` | `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `ytd`, `max` | How far back to fetch |
| `interval` | `1m`, `5m`, `15m`, `30m`, `1h`, `1d`, `1wk`, `1mo` | Candle resolution |

> **Note:** Yahoo Finance restricts intraday intervals (`1m`–`30m`) to short periods (`1d`–`5d`). Use `1h` or `1d` for longer periods.

---

## How It Works

1. **Backend loads real historical data** from Yahoo Finance at startup (configurable via `config.json`).
2. **Frontend connects** over a WebSocket and sends a **moving average window** parameter (default: 20).
3. **Backend runs VectorBT** — simulates an MA crossover strategy and returns:
   - The **equity curve** (portfolio value over time)
   - The **price data** and **MA line** for visual reference
4. **Frontend renders** a two-pane Canvas chart:
   - **Top pane** — equity curve (how the strategy performed)
   - **Bottom pane** — price with the moving average overlay

The default **simulated** strategy triggers a buy when price crosses **above** the moving average and a sell when it crosses **below**. Adjust the MA window in the input box and click **Send** to re-run the backtest.

> **Note:** This is a historical backtest only. No live trades are executed.

---

## Architecture

### Backend (`backend/`)
- **FastAPI + Uvicorn** — async WebSocket server
- **VectorBT** — vectorized backtesting engine (NumPy/Pandas)
- **YFinance** — market data source
- **MessagePack** — binary serialization over WebSocket
- **Redis** — optional result cache (falls back to in-memory dict)

### Frontend (`frontend/`)
- **Next.js (React)** — UI shell
- **Canvas API** — custom lightweight two-pane chart
  - Top: equity curve
  - Bottom: price + moving average overlay
- **@msgpack/msgpack** — binary deserialization

### Data Flow
```
Frontend  ──(MsgPack over WebSocket)──▶  Backend
  │                                          │
  │  { ma_window: 20 }                  Runs VectorBT backtest
  │                                          │
  ◀──(MsgPack: { roi, timestamps, values,    │
  │               price_values, ma_values })──┘
  │
  Top pane:    Equity curve
  Bottom pane: Price + MA overlay
```

---

## Project Structure

```
OddBot/
├── backend/
│   ├── main.py         # FastAPI app, WebSocket handler, backtest logic
│   ├── config.json     # Market data config (symbol, period, interval)
│   └── venv/           # Python virtual environment
├── frontend/
│   ├── pages/
│   │   └── index.js    # Main page with WS connection and controls
│   ├── component/
│   │   └── HedgeChart.js  # Two-pane Canvas chart (equity + price/MA)
│   └── package.json
├── example.jpg         # Screenshot
└── readme.md
```
