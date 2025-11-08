import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import { OrderService } from './services/OrderService';
import { WebsocketManager } from './services/WebsocketManager';
import { startOrderWorker } from './processors/orderProcessor';
import dotenv from 'dotenv';
import { Order } from './types';

dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(websocketPlugin);

const wsManager = new WebsocketManager();
const orderService = new OrderService(wsManager);

// start worker
startOrderWorker(wsManager);

fastify.route({
  url: '/api/orders/execute',
  method: ['POST', 'GET'],
  wsHandler: (conn, req) => {
    conn.on('message', async (msg: Buffer) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data && data.order) {
          const id = await orderService.createOrderAndEnqueue(data.order as Order, conn);
          conn.send(JSON.stringify({ orderId: id }));
        } else if (data && data.subscribeOrderId) {
          wsManager.attach(conn, data.subscribeOrderId);
          conn.send(JSON.stringify({ subscribed: data.subscribeOrderId }));
        } else {
          conn.send(JSON.stringify({ error: 'invalid payload' }));
        }
      } catch (err) {
        conn.send(JSON.stringify({ error: 'invalid payload' }));
      }
    });
  },
  handler: async (request, reply) => {
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
  }
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
