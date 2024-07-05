import * as amqp from 'amqplib';
import KSUID from 'ksuid';
import {RABBIT_ORDERS_QUEUE} from 'constants.js';
import {mdc} from '@logger';
import {genCorrelationId} from 'helpers.js';

const queue = RABBIT_ORDERS_QUEUE;

export async function sendToRabbit(content: Record<string, unknown> = {}) {
  const connection = await amqp.connect('amqp://user:pass@localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue(queue, {durable: false});

  channel.sendToQueue(queue, Buffer.from(JSON.stringify(content)), {
    messageId: KSUID.randomSync().string,
    'x-correlation-id': mdc.safeGet('correlationId', genCorrelationId())
  });
}
