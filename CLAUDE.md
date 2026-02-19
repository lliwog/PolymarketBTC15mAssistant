# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install   # install dependencies
npm start     # run the assistant (node src/index.js)
```

No build step. No test suite. The app runs directly with Node.js 18+.

## Architecture

The app is a real-time terminal dashboard that polls every 1 second (`CONFIG.pollIntervalMs`). It is pure ESM (`"type": "module"`).

### Data flow (src/index.js main loop)

Three WebSocket streams start at launch and run in the background:
- `binanceWs.js` — Binance trade stream (spot price ticks)
- `polymarketLiveWs.js` — Polymarket's live WS (Chainlink BTC/USD price, same feed as the Polymarket UI)
- `chainlinkWs.js` — Fallback: Chainlink on-chain price via Polygon WSS RPC

Each stream exposes `getLast()`. The main loop reads from them without awaiting; HTTP fetches fill gaps.

**Price priority for "current price" (settlement reference):**
Polymarket WS → Chainlink WS → Chainlink HTTP (`src/data/chainlink.js` via Polygon RPC)

**Per-tick the main loop:**
1. Fetches Binance 1m and 5m klines + last price
2. Resolves the active Polymarket market (cached; auto-selects latest 15m BTC market via series ID)
3. Fetches Polymarket CLOB prices and order book for UP/DOWN tokens
4. Computes indicators (VWAP, RSI, MACD, Heiken Ashi)
5. Runs the scoring pipeline (see Engines below)
6. Renders the terminal screen using `readline.cursorTo` + `clearScreenDown`
7. Appends a row to `./logs/signals.csv`

### Engines (src/engines/)

| File | Purpose |
|------|---------|
| `regime.js` | Classifies market as TREND_UP / TREND_DOWN / RANGE / CHOP based on VWAP position, slope, and volume |
| `probability.js` | `scoreDirection()` — weighted score system producing `rawUp` probability; `applyTimeAwareness()` — decays signal toward 50% as time runs out |
| `edge.js` | `computeEdge()` — model probability minus market price = edge; `decide()` — phase-gated (EARLY/MID/LATE) thresholds to produce ENTER or NO_TRADE |

### Indicators (src/indicators/)

Pure functions operating on arrays of OHLCV candle objects. No external indicator libraries.

### Configuration (src/config.js)

All tuneable parameters live here. Environment variables override defaults for Polymarket slugs, Polygon RPC URLs, and proxy settings. No `.env` file loading — set env vars in your shell before running.

### Proxy (src/net/proxy.js)

`applyGlobalProxyFromEnv()` is called once at startup and sets undici's global dispatcher for all HTTP fetches. WebSocket connections use `wsAgentForUrl()` which returns an `HttpsProxyAgent` or `SocksProxyAgent`. Standard env vars: `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY` (case-insensitive).

### Logs (./logs/)

Auto-created at runtime:
- `signals.csv` — appended every poll tick with regime, signal, model probabilities, market prices, edge, and recommendation
- `polymarket_market_<slug>.json` — raw market object dump on first encounter of each market slug
