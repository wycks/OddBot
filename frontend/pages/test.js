import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { encode, decode } from "@msgpack/msgpack";

// Load echarts-for-react only on client
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export default function Test() {
  const [pricePoints, setPricePoints] = useState([]); // [[ms, value], ...]
  const [equityPoints, setEquityPoints] = useState([]); // [[ms, equity], ...]

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      ws.send(encode({ ma_window: 20 }));
    };

    ws.onmessage = (ev) => {
      try {
        const payload = decode(new Uint8Array(ev.data));
        const ts = payload.timestamps || [];
        const vals = payload.values || [];
        const pricePts = ts.map((t, i) => [t * 1000, vals[i]]);
        setPricePoints(pricePts);

        // prefer backend-provided equity / portfolio series if available
        const equityArr =
          payload.equity ||
          payload.equity_values ||
          payload.portfolio_equity ||
          payload.portfolio_values ||
          null;

        let equityPts;
        if (Array.isArray(equityArr) && equityArr.length === ts.length) {
          equityPts = ts.map((t, i) => [t * 1000, equityArr[i]]);
        } else {
          // fallback: normalized price as a proxy (start at 100)
          if (vals.length) {
            const base = vals[0] || 1;
            equityPts = ts.map((t, i) => [t * 1000, (vals[i] / base) * 100]);
          } else {
            equityPts = [];
          }
        }
        setEquityPoints(equityPts);

        console.debug("test: received payload", {
          count: pricePts.length,
          roi: payload.roi,
          equityProvided: !!equityArr,
        });
      } catch (err) {
        console.error("msgpack decode error", err);
      }
    };

    ws.onerror = (e) => console.error("ws error", e);
    ws.onclose = () => console.info("ws closed");

    return () => ws.close();
  }, []);

  const option = {
    backgroundColor: "#071022",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params) => {
        if (!params || !params[0]) return "";
        return params
          .map(p => `${p.seriesName} (${p.axisIndex===1 ? "right" : "left"}): ${p.value[1].toFixed(2)}`)
          .join("<br/>");
      },
    },
    grid: { left: 8, right: 60, top: 40, bottom: 24 },
    xAxis: { type: "time", axisLine: { lineStyle: { color: "#9fb6d6" } }, axisLabel: { color: "#9fb6d6" } },
    yAxis: [
      { // left: price
        type: "value",
        name: "Price",
        position: "left",
        axisLabel: { color: "#4fd1c5" },
        splitLine: { show: false },
      },
      { // right: equity
        type: "value",
        name: "Equity",
        position: "right",
        axisLabel: { color: "#ffa726" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Price",
        type: "line",
        showSymbol: false,
        data: pricePoints,
        yAxisIndex: 0,
        lineStyle: { color: "#4fd1c5", width: 1.5 },
        areaStyle: { color: "rgba(79,209,197,0.04)" },
      },
      {
        name: "Equity",
        type: "line",
        showSymbol: false,
        data: equityPoints,
        yAxisIndex: 1,
        lineStyle: { color: "#ffa726", width: 1.5 },
        areaStyle: { color: "rgba(255,167,38,0.04)" },
      },
    ],
  };

  return (
    <main style={{ padding: 20 }}>
      <h2>Test: ECharts (price + equity)</h2>
      <p>This route is isolated from index — URL: /test</p>
      <div style={{ width: "100%", height: 640 }}>
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
      </div>
    </main>
  );
}