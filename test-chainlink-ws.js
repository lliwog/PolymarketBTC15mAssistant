import { config as loadDotenv } from "dotenv";
loadDotenv();
import WebSocket from "ws";
import { ethers } from "ethers";
import { wsAgentForUrl } from "./src/net/proxy.js";

const url = process.env.POLYGON_WSS_URL;
const aggregator = process.env.CHAINLINK_BTC_USD_AGGREGATOR || "0xc907E116054Ad103354f2D350FD2514433D57F6f";
const topic0 = ethers.id("AnswerUpdated(int256,uint256,uint256)");

if (!url) {
  console.error("POLYGON_WSS_URL not set in .env");
  process.exit(1);
}

console.log("Connecting to:", url);
console.log("Aggregator:   ", aggregator);
console.log("Waiting for AnswerUpdated events (can take 1-5 min)...\n");

const ws = new WebSocket(url, { agent: wsAgentForUrl(url) });

ws.on("open", () => {
  console.log("[OK] Connected");
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_subscribe",
    params: ["logs", { address: aggregator, topics: [topic0] }]
  }));
});

ws.on("message", (buf) => {
  const msg = JSON.parse(buf.toString());

  // Subscription confirmation
  if (msg.id === 1) {
    if (msg.error) {
      console.error("[FAIL] Subscription error:", msg.error);
      process.exit(1);
    }
    console.log("[OK] Subscribed, id:", msg.result);
    return;
  }

  // Price event
  if (msg.method === "eth_subscription") {
    const log = msg.params?.result;
    const topics = log?.topics ?? [];
    if (topics.length >= 2) {
      const raw = ethers.toBigInt(topics[1]);
      const price = Number(raw >= (1n << 255n) ? raw - (1n << 256n) : raw) / 1e8;
      console.log(`[PRICE] $${price.toFixed(2)}  at ${new Date().toISOString()}`);
    }
    return;
  }

  console.log("[MSG]", JSON.stringify(msg));
});

ws.on("error", (err) => console.error("[ERROR]", err.message));
ws.on("close", (code, reason) => console.log("[CLOSED]", code, reason.toString()));
