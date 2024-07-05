import {AsyncResource} from 'node:async_hooks';
import {EachMessagePayload, Kafka} from 'kafkajs';
import {KAFKA_BROKERS, KAFKA_ORDERS_TOPIC} from 'constants.js';
import {baseLogger, loggerBindings, mdc} from '@logger';
import {createOrder} from '@service';
import {logCreator} from './logging.js';

const topic = KAFKA_ORDERS_TOPIC;
const groupId = 'my-group';

const logger = baseLogger.child(
  {
    ...loggerBindings(import.meta.url),
    topic,
    groupId
  },
  {
    msgPrefix: '[kafka] '
  }
);

const kafka = new Kafka({
  clientId: 'my-consumer',
  brokers: KAFKA_BROKERS,
  logCreator
});

export const startConsumer = async () => {
  const consumer = kafka.consumer({groupId});
  await consumer.connect();
  await consumer.subscribe({topic, fromBeginning: true});
  logger.info(`Consumer subscribed (topic=${topic})`);

  const messageHandler = async (emp: EachMessagePayload) => {
    if (!emp.message?.value) return;
    const messageId = emp.message.headers?.['messageId'];
    const correlationId = emp.message.headers?.['x-correlation-id']?.toString();
    const orderDetails = JSON.parse(emp.message.value.toString());

    mdc.set('messageId', messageId);
    mdc.set('correlationId', correlationId);
    mdc.set('user', {id: orderDetails.userId});

    logger.info(
      {content: orderDetails, messageId, topic},
      `Received message (topic=${topic})`
    );

    await createOrder(orderDetails);
  };

  await consumer.run({
    eachMessage: async (msg: EachMessagePayload) => {
      const scope = {
        entrypoint: 'kafka/consumer'
      };
      await mdc.run(scope, () => {
        const asyncResource = new AsyncResource('kafka-consumer/orders');
        return asyncResource.runInAsyncScope(messageHandler, null, msg);
      });
    }
  });

  return {
    async close() {
      await consumer.disconnect();
    }
  };
};
