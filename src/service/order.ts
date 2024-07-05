import {baseLogger, loggerBindings, mdc} from '@logger';
import {orderQueue} from 'bull-jobs/order.js';
import {genRandomId, sleep} from 'helpers.js';

const logger = baseLogger.child(loggerBindings(import.meta.url));

interface OrderDetails {
  userId: number;
  productId: number;
  quantity: number;
}

interface Order {
  id: string;
  userId: number;
  productId: number;
  quantity: number;
}

export async function getOrders(
  userId: number
): Promise<Record<string, unknown>[]> {
  await sleep(10);
  logger.info('Fetched orders');
  return [
    {
      id: 1,
      userId,
      productId: 1,
      quantity: 2
    },
    {
      id: 2,
      userId,
      productId: 2,
      quantity: 1
    }
  ];
}

export async function createOrder(orderDetails: OrderDetails): Promise<Order> {
  const order = {...orderDetails, id: genRandomId()};
  const processRequest = {
    order,
    correlationId: mdc.get('correlationId')
  };
  // Send order to the queue
  await sleep(1000);
  await orderQueue.add(processRequest, {delay: 1000});
  logger.info({domain: order}, 'Submitted order');
  return order;
}

export function buggyOrder() {
  logger.error('Order is buggy!');
  throw new Error('kaboom!');
}
