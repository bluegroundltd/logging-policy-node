import * as amqp from 'amqplib';
import {AsyncResource} from 'node:async_hooks';
import {MDCStore, baseLogger, loggerBindings, mdc} from '@logger';
import {RABBIT_ORDERS_QUEUE} from 'constants.js';
import {createOrder} from '@service';

const queue = RABBIT_ORDERS_QUEUE;

const logger = baseLogger.child({
  ...loggerBindings(import.meta.url),
  queue
});
const logctx = 'rabbit';

export async function startConsumer() {
  try {
    const connection = await amqp.connect('amqp://devuser:devpass@localhost');
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, {durable: false});

    const consumer = async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;
      const messageId = msg.properties.messageId;
      const content = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;

      mdc.set('messageId', messageId);
      mdc.set('correlationId', correlationId);
      mdc.set('user', {id: content.userId});

      logger.info(
        {
          content,
          messageId
        },
        `[${logctx}] Received message (queue=${queue})`
      );
      await createOrder(content.userId, content.productId, content.quantity);
      channel.ack(msg);
    };

    channel.consume(queue, (msg: amqp.ConsumeMessage | null) => {
      const scope = {
        entrypoint: 'rabbit/consumer'
      };
      mdc.run(scope, () => {
        const asyncResource = new AsyncResource('rabbit-consumer/orders');
        asyncResource.runInAsyncScope(consumer, null, msg);
      });
    });

    logger.info(`[${logctx}] Consumer connected (queue=${queue})`);

    return {
      close: async () => {
        await connection.close().catch(() => {});
      }
    };
  } catch (err) {
    logger.error(
      {err},
      `[${logctx}] Error starting Rabbit consumer. (queue=${queue})`
    );
    throw err;
  }
}
