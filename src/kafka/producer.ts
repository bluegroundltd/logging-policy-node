import {Kafka} from 'kafkajs';
import {KAFKA_ORDERS_TOPIC} from 'constants.js';
import {mdc} from '@logger';
import {genCorrelationId} from 'helpers.js';
import {logCreator} from './logging.js';

const kafka = new Kafka({
  clientId: 'my-producer',
  brokers: ['localhost:19092'],
  logCreator
});

const producer = kafka.producer();
const topic = KAFKA_ORDERS_TOPIC;

export async function sendToKafka(payload: Record<string, unknown> = {}) {
  await producer.connect();

  const correlationId = mdc.safeGet('correlationId', genCorrelationId());

  await producer.send({
    topic,
    messages: [{value: JSON.stringify(payload), headers: {correlationId}}]
  });
}
