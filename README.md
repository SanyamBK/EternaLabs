# Order Execution Engine — Mock Implementation

## Overview
This repository implements a mock order execution engine for a single order type (market orders by default) with DEX routing, real-time WebSocket status updates, and an order processing queue. The DEX router simulates Raydium and Meteora with realistic network delays and price variance.

Core features:
- Single endpoint `/api/orders/execute` supporting both POST and WebSocket upgrades.
- MockDEx router comparing quotes and selecting best execution venue.
- BullMQ + Redis-based queue with exponential backoff (≤3 attempts).
- WebSocket lifecycle events: pending → routing → building → submitted → confirmed/failed.
- Docker Compose for local testing (Redis + Postgres + App).
- Unit tests (Jest) and a Postman collection.

## Why Market Orders (choice)
I implemented **market orders** to demonstrate the full execution lifecycle and routing. Market orders emphasize immediate routing & execution, allowing us to show deterministic matching and end-to-end status events. The engine is modular and can be extended to:

- **Limit orders**: add a price watcher component that enqueues when market price meets target.
- **Sniper orders**: add a block/tx watch and token listing monitor to trigger an immediate market buy.

## Quickstart (local)
1. Clone and install:
```bash
git clone https://github.com/SanyamBK/order-exec-engine.git
cd order-exec-engine
npm install
````

2. Start with Docker:

```bash
docker-compose up --build
```

3. Start app:

```bash
npm run dev
# server on http://localhost:3000
```

## API

### POST /api/orders/execute

* Accepts JSON: `{ userId, type, tokenIn, tokenOut, amountIn }`
* Returns: `{ orderId, ws }` (ws is suggested subscription path)
* After POST, open a WebSocket to the server and send `{ subscribeOrderId: "<orderId>" }` to receive status updates.

### WebSocket usage

* Connect to `ws://localhost:3000/api/orders/execute` (or same path upgraded via ws).
* Send: `{ subscribeOrderId: "<orderId>" }`
* Events received: JSON objects with `status` field and additional info (chosenDex, txHash, error).

## Design decisions

* **Mock DEX**: Emulates price spreads (2-5%) and 2–3s execution delays. This keeps the focus on routing logic and system architecture.
* **BullMQ**: provides robust retries and concurrency settings. Default concurrency is configured in worker.
* **WebSocket manager**: lightweight in-memory map for connection management. Production: use Redis pub/sub for multi-instance.
* **Persistence**: orders stored in Postgres (simple table). In this mock, primary focus is on lifecycle and routing; persistence hooks are present.

## Tests

Run tests:

```bash
npm test
```

## Postman

Import `postman/OrderExecution.postman_collection.json` to experiment.

## Deployment

* For a single instance quick deployment use Railway / Render.
* Use managed Redis and Postgres for production.
* Replace MockDexRouter with Raydium/Meteora SDKs for real devnet execution (see docs in `/docs`).

## Next steps (if you want real devnet)

* Integrate `@raydium-io/raydium-sdk-v2` and Meteora SDK.
* Add wallet signing, devnet faucet, and transaction confirmation flows.
* Implement rate limiting and authentication.

## Contact

Sanyam Barwar — [sanyam22447@iiitd.ac.in](mailto:sanyam22447@iiitd.ac.in)