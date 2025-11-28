# Architecture & Stack Overview

## Project Philosophy

This is a **Hedge-Fund Grade** SaaS application designed for high-frequency strategy backtesting and execution. The core architectural constraint is **ultra-low latency**. We prioritize data locality, in-memory processing, and binary transport protocols to achieve near-native desktop performance in the browser.

## The Architecture: "The Speed Stack"

### 1. The Frontend (Visual Layer)

- **Framework:** **Next.js (React)**. Handles the UI shell, routing, and user state.
- **Visualization Engine:** **SciChart.js**.
  - **Role:** Renders massive financial datasets (millions of data points) at 60 FPS.
  - **Mechanism:** Uses WebGL and WebAssembly (Wasm).
  - **Optimization:** Bypasses standard JSON parsing. It accepts **Raw Memory Buffers** (Float64Arrays) directly from the backend for zero-copy rendering.

### 2. The Backend (Compute Layer)

- **Runtime:** **Python 3.13**.
- **API Server:** **FastAPI** running on **Uvicorn**. Optimized for asynchronous WebSocket handling.
- **Math Engine:** **VectorBT**.
  - **Role:** Performs vectorized backtesting and signal generation using NumPy/Pandas.
  - **Optimization:** Operates entirely on in-memory arrays. Avoids iterative loops.
- **Data Source:** **YFinance** (for MVP data fetching) / CCXT (for live execution).

### 3. The Protocol (Communication Layer)

- **Transport:** **WebSockets** (not REST). Maintains a persistent, open pipe between Client and Server.
- **Serialization:** **MessagePack (MsgPack)**.
  - **Role:** Compresses data into binary format.
  - **Data Type:** Transmits **Binary Arrays** (Float64).
  - **Flow:** Python (NumPy Array) $\to$ MsgPack $\to$ WebSocket $\to$ JS (Float64Array) $\to$ SciChart (Wasm Memory).

### 4. The Speed Layer (State & Caching)

- **Technology:** **Redis**.
- **Deployment:** Local **Docker** container (`redis:latest` on port `6379`).
- **Role:** Acts as the "Hot Path" storage.
  - Stores active user session state.
  - Caches market data to prevent repeated fetching during strategy iteration.
  - Ensures parameter adjustments trigger sub-50ms recalculations.

---

## Data Flow Lifecycle

1.  **User Action:** User adjusts a strategy parameter (e.g., RSI threshold) in the Next.js UI.
2.  **Binary Request:** Frontend packs the parameter into a binary message via **MsgPack** and sends it over the **WebSocket**.
3.  **In-Memory Calc:** FastAPI receives the binary, unpacks it, and triggers **VectorBT**.
4.  **Vectorized Processing:** VectorBT recalculates the strategy using cached data in **RAM/Redis** (no SQL or disk I/O).
5.  **Binary Response:** The resulting equity curve and signals are packed into a binary array.
6.  **Direct Rendering:** **SciChart** receives the binary stream and dumps it directly into WebGL memory for an instant chart update.

---

## Tooling & Directory Structure

### `/backend` (Python Environment)

- **Manager:** `venv` (Virtual Environment).
- **Core Libraries:**
  - `fastapi`, `uvicorn`: ASGI Server.
  - `websockets`: Communication.
  - `vectorbt`: Quant logic.
  - `numpy`, `pandas`: Data structures.
  - `msgpack`: Binary serialization.
  - `redis`: Cache interface.
  - `yfinance`: Market data.

### `/frontend` (Node Environment)

- **Manager:** `npm`.
- **Core Libraries:**
  - `next`, `react`: App framework.
  - `scichart`: High-performance charting.
  - `@msgpack/msgpack`: Binary deserialization.

### Infrastructure

- **Docker:** Runs the local Redis instance.

  - Command: `docker run --name local-redis -p 6379:6379 -d redis`

  1. Run docker desktop for Redis: docker run --name local-redis -p 6379:6379 -d redis
  2. Setup backend: cd Backend python3.13 -m venv venv
  3. Activate environment : venv\Scripts\activate
  4. Install backend framework pip install "numpy>=2.0,<2.4" "numba==0.62.1" vectorbt fastapi uvicorn websockets msgpack redis yfinance
  5. Create server file main.py
  6. Create front-end npm install scichart @msgpack/msgpack
  7.
