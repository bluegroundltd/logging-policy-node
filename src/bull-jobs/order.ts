import {AsyncResource} from 'node:async_hooks';
import Queue, {Job} from 'bull';
import {REDIS_URL} from 'constants.js';
import {baseLogger, loggerBindings, mdc} from '@logger';
import {sleep} from 'helpers.js';

const logger = baseLogger.child(
  {
    ...loggerBindings(import.meta.url),
  },
  {msgPrefix: '[bull] '}
);

interface OrderProcessRequest {
  order: {
    id: string;
    userId: number;
    productId: number;
    quantity: number;
  };
  correlationId?: string;
}

export const orderQueue = new Queue<OrderProcessRequest>('orderQueue', {
  redis: REDIS_URL
});

const processOrder = async (job: Job<OrderProcessRequest>) => {
  const {order, correlationId} = job.data;

  mdc.set('correlationId', correlationId);
  mdc.set('orderId', order.id);

  logger.info(
    {domain: {order: order}},
    `Processing order (orderId=${order.id})`
  );

  await sleep(1000);

  logger.info(
    {domain: {order: order}},
    `Order processed successfully (orderId=${order.id})`
  );
  return {success: true};
};

orderQueue.process(async (job: Job<OrderProcessRequest>) => {
  const scope = {
    entrypoint: 'bull/order'
  };
  await mdc.run(scope, () => {
    const asyncResource = new AsyncResource('bull/orders');
    return asyncResource.runInAsyncScope(processOrder, null, job);
  });
});
