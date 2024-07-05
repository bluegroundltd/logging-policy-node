import 'dotenv/config';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {FastifyInstance} from 'fastify';
import {logger} from '@logger';
import {createServer as createFastify} from './fastify-server/index.js';
import {createServer as createExpress} from './express-server/index.js';
import {createServer as createKoa} from './koa-server/index.js';
import {startConsumer as startRabbitConsumer} from './rabbit/index.js';
import {startConsumer as startKafkaConsumer} from './kafka/index.js';
import monitorAsync from './debug/async-monitor.js';
import {Server} from 'http';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

// Monitor all async functions via async_hooks
// and log their lifecycle events at DEBUG level
// Use `LOG_LEVEL=debug npm run <cmd>` to see the logs
monitorAsync('Promise');

async function startFastify() {
  const server = await createFastify();

  try {
    await server.listen({port, host});
    return server;
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function startExpress() {
  const server = await createExpress();

  try {
    const httpServer = await server.listen({port, host});
    logger.info(`[server] Express listening at http://${host}:${port}`);
    return httpServer;
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function startKoa() {
  const server = await createKoa();

  try {
    const httpServer = await server.listen({port, host});
    logger.info(`[server] Koa listening at http://${host}:${port}`);
    return httpServer;
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

(async () => {
  const argv = await yargs(hideBin(process.argv))
    .options({
      fastify: {type: 'boolean', default: false},
      express: {type: 'boolean', default: false},
      koa: {type: 'boolean', default: false}
    })
    .parse();

  let server: FastifyInstance | Server | undefined;

  if (argv.fastify) {
    server = await startFastify();
  } else if (argv.express) {
    server = await startExpress();
  } else if (argv.koa) {
    server = await startKoa();
  }

  const {close: closeRabbit} = await startRabbitConsumer();
  const {close: closeKafka} = await startKafkaConsumer();

  // NOTE:
  // Poor man's cleanup. Don't copy this in production.
  process.once('SIGINT', async () => {
    logger.info('Shutting down...');
    await closeRabbit();
    await closeKafka();
    await server?.close();
    process.exit();
  });
})();
