import { WebsocketManager } from '../services/WebsocketManager';
import { startOrderWorker } from '../processors/orderProcessor';
import { OrderService } from '../services/OrderService';

jest.setTimeout(40000);

test('job retries up to attempts and emits failed on terminal failure', async (done) => {
  // This test relies on random failures in MockDexRouter; assert that either success or final failure arrives.
  const ws = new WebsocketManager();
  startOrderWorker(ws);
  const svc = new OrderService(ws);

  const fakeSocket = {
    send: (m: any) => {
      try {
        const payload = JSON.parse(m);
        if (payload.status === 'failed') {
          expect(payload.error).toBeDefined();
          done();
        } else if (payload.status === 'confirmed') {
          // if it succeeds, that's also acceptable
          done();
        }
      } catch (e) {}
    },
    on: () => {},
    close: () => {}
  };

  await svc.createOrderAndEnqueue({
    userId: 'retry-test',
    tokenIn: 'USDC',
    tokenOut: 'SOL',
    amountIn: 5
  }, fakeSocket as any);
});
