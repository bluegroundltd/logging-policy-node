import {EachMessagePayload, Kafka} from 'kafkajs';
import {AsyncResource} from 'node:async_hooks';
import {KAFKA_BROKERS, KAFKA_ORDERS_TOPIC} from 'constants.js';
import {baseLogger, loggerBindings, mdc} from '@logger';
import {createOrder} from '@service';
import {logCreator} from './logging.js';

const topic = KAFKA_ORDERS_TOPIC;
const groupId = 'my-group';

const logger = baseLogger.child({
  ...loggerBindings(import.meta.url),
  topic,
  groupId
});
const logctx = 'kafka';

const kafka = new Kafka({
  clientId: 'my-consumer',
  brokers: KAFKA_BROKERS,
  logCreator
});

export const startConsumer = async () => {
  const consumer = kafka.consumer({groupId});
  await consumer.connect();
  await consumer.subscribe({topic, fromBeginning: true});
  logger.info(`[${logctx}] Consumer subscribed (topic=${topic})`);

  const messageHandler = async (emp: EachMessagePayload) => {
    if (!emp.message?.value) return;
    const messageId = emp.message.headers?.['messageId'];
    const correlationId = emp.message.headers?.['correlationId']?.toString();
    const orderDetails = JSON.parse(emp.message.value.toString());

    mdc.set('messageId', messageId);
    mdc.set('correlationId', correlationId);
    mdc.set('user', {id: orderDetails.userId});

    logger.info(
      {content: orderDetails, messageId, topic},
      `[${logctx}] Received message (topic=${topic})`
    );

    await createOrder(orderDetails);
  };

  await consumer.run({
    eachMessage: async (msg: EachMessagePayload) => {
      const scope = {
        entrypoint: 'kafka/consumer'
      };
      mdc.run(scope, () => {
        const asyncResource = new AsyncResource('kafka-consumer/orders');
        asyncResource.runInAsyncScope(messageHandler, null, msg);
      });
    }
  });

  return {
    async close() {
      await consumer.disconnect();
    }
  };
};
