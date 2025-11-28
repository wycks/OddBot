import { useEffect, useState, useRef } from "react";
import { encode, decode } from "@msgpack/msgpack";
import HedgeChart from "../component/HedgeChart";

export default function Home() {
  const [ma, setMa] = useState(20);
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState(null);
  const [redisStatus, setRedisStatus] = useState("unknown");
  const wsRef = useRef(null);

  // create persistent WebSocket and health fetch
  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // send initial request
      ws.send(encode({ ma_window: ma }));
    };

    ws.onmessage = (ev) => {
      try {
        const payload = decode(new Uint8Array(ev.data));
        console.log('WS message payload:', payload);
        setLast(payload);
      } catch (err) {
        console.error("unpack error", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (e) => console.error("ws error", e);

    // fetch redis health once on mount
    fetch("http://127.0.0.1:8000/health")
      .then((r) => r.json())
      .then((j) => setRedisStatus(j.redis || "unknown"))
      .catch(() => setRedisStatus("down"));

    return () => {
      try { ws.close(); } catch (e) {}
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }
    ws.send(encode({ ma_window: Number(ma) }));
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>Frontend test</h1>
      <div>WS connected: {connected ? "yes" : "no"}</div>
      <div>Redis: {redisStatus}</div>
      <div style={{ marginTop: 8 }}>
        <strong>Payload debug:</strong>
        <div>timestamps: {last?.timestamps?.length ?? 0}</div>
        <div>values: {last?.values?.length ?? 0}</div>
        <pre style={{ maxHeight: 200, overflow: 'auto' }}>{last ? JSON.stringify({ roi: last.roi, timestamps_sample: (last.timestamps || []).slice(-5), values_sample: (last.values || []).slice(-5) }, null, 2) : 'no data'}</pre>
      </div>
      <div style={{ marginTop: 10 }}>
        <label>
          MA window: {" "}
          <input value={ma} onChange={(e) => setMa(e.target.value)} />
        </label>
        <button onClick={() => send()} style={{ marginLeft: 8 }}>
          Send
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {last && last.timestamps && last.values ? (
          <HedgeChart data={last} />
        ) : (
          <div>No chart data yet</div>
        )}
      </div>
    </main>
  );
}