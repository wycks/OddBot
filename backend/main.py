# Backend/main.py
import asyncio

import msgpack
import numpy as np
import redis
import vectorbt as vbt
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

#    To change the data source:
# - 1. Quick (env):  `CSV_PATH=path/to/file.csv`,
# - 2. Direct edit: replace the `vbt.YFData.download(...)` call with your own loader
# - 3. Vectorbt adapters: use other vectorbt data wrappers, there is 100 approx connectors.

# Redis cache handle
r_cache = None

# In-memory cache (fast RAM cache)
cache_mem = {}

# Allow Frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Local Redis
try:
    r_cache = redis.Redis(host="localhost", port=6379, db=0)
    r_cache.ping()
    print("Connected to Redis Speed Layer")
except Exception as e:
    r_cache = None
    print(f" Redis Connection Failed: {e}")


@app.get("/health")
async def health_check():
    """Simple health endpoint reporting Redis connectivity."""
    status = {"redis": "down"}
    try:
        if r_cache is not None:
            r_cache.ping()
            status["redis"] = "ok"
        else:
            status["redis"] = "down"
    except Exception:
        status["redis"] = "down"
    return status


# Load config
import json

with open("backend/config.json") as f:
    config = json.load(f)

# Pre-load Data into RAM (Simulating Hedge Fund Cache) from YFData = Yahoo Finance
print("Pre-loading Market Data...")
print(
    f"Config: {config['symbol']}, period={config['period']}, interval={config['interval']}"
)
price_data = vbt.YFData.download(
    config["symbol"], period=config["period"], interval=config["interval"]
).get("Close")
print("Data Loaded into RAM")

#  TODO Add save to DB functionality


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client Connected via WebSocket")

    try:
        while True:
            # 1. Receive Binary Data (Fast)
            raw_data = await websocket.receive_bytes()
            params = msgpack.unpackb(raw_data, raw=False)

            # 2. Extract Parameters
            window = int(params.get("ma_window", 20))
            # build a cache key for this parameter set (simple example)
            cache_key = f"backtest:ma:{window}".encode()

            # 3. Try in-memory cache first (fastest)
            cached = cache_mem.get(cache_key)
            if cached:
                print(f"In-memory cache hit for {cache_key.decode()}")
                await websocket.send_bytes(cached)
                continue

            # 4. Try to read from Redis cache
            if r_cache is not None:
                try:
                    r = r_cache.get(cache_key)
                    if r:
                        print(f"Redis cache hit for {cache_key.decode()}")
                        # populate in-memory cache as well
                        cache_mem[cache_key] = r
                        await websocket.send_bytes(r)
                        continue
                except Exception as e:
                    print(f"Redis read error: {e}")

            # 5. Run VectorBT
            def run_backtest(window_arg):
                fast_ma = vbt.MA.run(price_data, window=window_arg)
                entries = fast_ma.ma_crossed_above(price_data)
                exits = fast_ma.ma_crossed_below(price_data)
                pf = vbt.Portfolio.from_signals(price_data, entries, exits)
                equity = pf.value()
                # Convert index to Unix seconds regardless of internal resolution
                ts_ns = equity.index.astype(np.int64)
                if ts_ns[0] > 1e12:  # nanoseconds → seconds
                    timestamps = (ts_ns // 10**9).tolist()
                else:  # already seconds
                    timestamps = ts_ns.tolist()
                values = equity.values.tolist()
                # Price and MA data for the bottom chart overlay
                ma_series = fast_ma.ma
                ma_vals = [None if np.isnan(v) else float(v) for v in ma_series.values]
                price_vals = price_data.values.tolist()
                result = {
                    "roi": pf.total_return(),
                    "timestamps": timestamps,
                    "values": values,
                    "price_values": price_vals,
                    "ma_values": ma_vals,
                }
                return msgpack.packb(result, use_bin_type=True)

            # Execute blocking compute in a thread to avoid blocking the event loop
            packed = await asyncio.to_thread(run_backtest, window)

            # store in in-memory cache
            try:
                cache_mem[cache_key] = packed
            except Exception:
                pass

            # store in Redis (best-effort) with short TTL
            if r_cache is not None:
                try:
                    r_cache.set(cache_key, packed, ex=60)  # cache 60s
                    print(f"💾 Cached result for {cache_key.decode()}")
                except Exception as e:
                    print(f"Redis write error: {e}")

            # 6. Send Binary Response
            await websocket.send_bytes(packed)

    except Exception as e:
        print(f"Client Disconnected: {e}")
