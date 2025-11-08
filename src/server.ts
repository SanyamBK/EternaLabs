import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import { OrderService } from './services/OrderService';
import { WebsocketManager } from './services/WebsocketManager';
import { startOrderWorker } from './processors/orderProcessor';
import { Order } from './types';
import fs from 'fs';
import path from 'path';

const fastify = Fastify({ logger: true });
fastify.register(cors, {
  origin: true,
  credentials: true
});
fastify.register(websocketPlugin, {
  options: {
    maxPayload: 1048576
  }
});

const wsManager = new WebsocketManager();
const orderService = new OrderService(wsManager);

// start worker
startOrderWorker(wsManager);

// Root endpoint with API info
fastify.get('/', async (request, reply) => {
  return {
    name: 'EternaLabs Order Execution Engine',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'POST /api/orders/execute': 'Submit a new order',
      'GET /api/orders/execute (WebSocket)': 'Subscribe to order updates',
      'GET /health': 'Health check'
    },
    docs: 'https://github.com/SanyamBK/EternaLabs',
    deployment: 'Railway'
  };
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// Demo UI endpoint
fastify.get('/demo', async (request, reply) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'demo.html');
  try {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    reply.type('text/html').send(html);
  } catch (error) {
    reply.code(404).send({ error: 'Demo page not found. Use the test-client-railway.html file locally.' });
  }
});

// HTTP POST endpoint for order submission
fastify.post('/api/orders/execute', async (request, reply) => {
  const body = request.body as any;
  if (!body || !body.tokenIn || !body.tokenOut || !body.amountIn) {
    return reply.code(400).send({ error: 'missing required fields: tokenIn, tokenOut, amountIn' });
  }
  const orderId = uuidv4();
  const order: Order = {
    id: orderId,
    userId: body.userId || 'anon',
    type: body.type || 'market',
    tokenIn: body.tokenIn,
    tokenOut: body.tokenOut,
    amountIn: body.amountIn,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  await orderService.createOrderAndEnqueue(order);
  return reply.code(202).send({ orderId, ws: `/api/orders/execute` });
});

// WebSocket endpoint for real-time updates
fastify.register(async function (fastify) {
  fastify.get('/api/orders/execute', { websocket: true }, (connection, req) => {
    connection.on('message', async (msg: Buffer) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data && data.order) {
          const id = await orderService.createOrderAndEnqueue(data.order as Order, connection);
          connection.send(JSON.stringify({ orderId: id }));
        } else if (data && data.subscribeOrderId) {
          wsManager.attach(connection, data.subscribeOrderId);
          connection.send(JSON.stringify({ subscribed: data.subscribeOrderId }));
        } else {
          connection.send(JSON.stringify({ error: 'invalid payload' }));
        }
      } catch (err) {
        connection.send(JSON.stringify({ error: 'invalid payload' }));
      }
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT ? Number(process.env.PORT) : 3000, host: '0.0.0.0' });
    fastify.log.info('server started');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
