## Project 

Designed for high-frequency strategy backtesting and eventually execution. 

## The Architecture:

### 1. Frontend (Visual Layer)

- **Framework:** **Next.js (React)**. Handles the UI shell, routing, and user state.
- **Visualization Engine:** **Apache ECharts**.
  - **Role:** Renders massive financial datasets (millions of data points) at 60 FPS.
  - **Mechanism:** Uses WebGL and WebAssembly (Wasm).
  - **Optimization:** Bypasses standard JSON parsing. Accepts **Raw Memory Buffers** (Float64Arrays) directly from the backend for zero-copy rendering.

### 2. Backend (Compute Layer)

- **Runtime:** **Python 3.13**.
- **API Server:** **FastAPI** running on **Uvicorn**. Optimized for asynchronous WebSocket handling. Inside local Docker.
- **Math Engine:** **VectorBT**.
  - **Role:** Performs vectorized backtesting and signal generation using NumPy/Pandas.
  - **Optimization:** Operates entirely on in-memory arrays. Avoids iterative loops.
- **Data Source:** **YFinance** (for MVP data fetching- Very basic / Free) / CCXT/Alpaca for live execution, not integrated yet.

### 3. Comms Layer

- **Transport:** **WebSockets** Maintains a persistent, open pipe between Client and Server.
- **Serialization:** **MessagePack (MsgPack)**.
  - **Role:** Compresses data into binary format.
  - **Data Type:** Transmits **Binary Arrays** (Float64).
  - **Flow:** Python (NumPy Array) $\to$ MsgPack $\to$ WebSocket $\to$ JS (Float64Array) $\to$ eCharts (Wasm Memory).

### 4. State & Caching

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
  - `echarts`: High-performance charting.
  - `@msgpack/msgpack`: Binary deserialization.

### Infrastructure

1. Run Docker - Redis `docker start local-redis`
2. Run Python VE: `.\.venv\Scripts\Activate.ps1`
3. Run fastAPI - `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`
4. Run react Front End -`npm run dev`

## TODO: Add AI integration, for LLM based contests running on cron

1. Add AI chat interface --> trading schema (zod)
2. Confirm startegy - Loopback (natural language)
3. Turn schema into API request (simulate)
4. Cron every x hours
