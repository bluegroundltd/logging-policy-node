import * as amqp from 'amqplib';
import {AsyncResource} from 'node:async_hooks';
import {baseLogger, loggerBindings, mdc} from '@logger';
import {RABBIT_ORDERS_QUEUE} from 'constants.js';
import {createOrder} from '@service';

const queue = RABBIT_ORDERS_QUEUE;

const logger = baseLogger.child(
  {
    ...loggerBindings(import.meta.url),
    queue
  },
  {
    msgPrefix: '[rabbit] '
  }
);

export async function startConsumer() {
  try {
    const connection = await amqp.connect('amqp://user:pass@localhost');
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, {durable: false});

    const messageConsumer = async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;
      const messageId = msg.properties.messageId;
      const orderDetails = JSON.parse(msg.content.toString());
      const correlationId = msg.properties['x-correlation-id'];

      mdc.set('messageId', messageId);
      mdc.set('correlationId', correlationId);
      mdc.set('user', {id: orderDetails.userId});

      logger.info(
        {
          content: orderDetails,
          messageId
        },
        `Received message (queue=${queue})`
      );
      await createOrder(orderDetails);
      channel.ack(msg);
    };

    channel.consume(queue, async (msg: amqp.ConsumeMessage | null) => {
      const scope = {
        entrypoint: 'rabbit/consumer'
      };
      await mdc.run(scope, () => {
        const asyncResource = new AsyncResource('rabbit-consumer/orders');
        return asyncResource.runInAsyncScope(messageConsumer, null, msg);
      });
    });

    logger.info(`Consumer connected (queue=${queue})`);

    return {
      close: async () => {
        await connection.close().catch(() => {});
      }
    };
  } catch (err) {
    logger.error({err}, `Error starting Rabbit consumer. (queue=${queue})`);
    throw err;
  }
}
