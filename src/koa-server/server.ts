import Koa from 'koa';
import Router from 'koa-router';
import session from 'koa-session';
import bodyParser from 'koa-bodyparser';
import {StatusCodes} from 'http-status-codes';
import {buggyOrder, getProducts, getOrders, createOrder} from '@service';
import {setupRequestContext} from './context.js';
import {setupLogging} from './logging.js';
import {sendToRabbit} from 'rabbit/index.js';
import {sendToKafka} from 'kafka/index.js';

export function createServer() {
  const app = new Koa();
  const router = new Router();

  // x-response-time
  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', String(ms));
  });

  app.use(bodyParser());

  app.keys = ['thismustbeoflength32charactersanditshouldnotbelessthanthat'];
  app.use(
    session(
      {
        key: 'koa:sess',
        maxAge: 86400000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        signed: true
      },
      app
    )
  );

  // Setup MDC from request
  setupRequestContext(app);

  // Setup Logging
  setupLogging(app);

  // Middleware
  app.use(async (ctx, next) => {
    ctx.state.mdc = {meta: {random: Math.random()}};
    await next();
  });

  // Routes
  router.get('/', (ctx) => {
    ctx.body = 'Home';
  });

  router.post('/signin', (ctx) => {
    const {name, email} = ctx.request.body as {
      name: string;
      email: string;
    };

    if (!ctx.session) {
      throw new Error('Session not found');
    }

    ctx.session.user = {
      name: name ?? 'John Doe',
      email,
      id: Math.round(Math.random() * 100)
    };
    ctx.body = ctx.session;
  });

  router.post('/signout', async (ctx) => {
    ctx.session = null;
    ctx.body = 'Signed out';
  });

  router.get('/products', async (ctx) => {
    const products = await getProducts();
    ctx.body = products;
  });

  router.get('/orders', async (ctx) => {
    if (!ctx?.session?.user) {
      ctx.status = StatusCodes.UNAUTHORIZED;
      return;
    }
    const orders = await getOrders(ctx.session.user.id);
    ctx.body = orders;
  });

  router.post('/orders', async (ctx) => {
    if (!ctx?.session?.user) {
      ctx.status = StatusCodes.UNAUTHORIZED;
      return;
    }
    const {productId, quantity} = ctx.request.body as {
      productId: number;
      quantity: number;
    };
    const userId = ctx.session.user.id;
    const orders = await createOrder({userId, productId, quantity});
    ctx.body = orders;
  });

  router.get('/error', async (ctx) => {
    const error = await buggyOrder();
    ctx.body = error;
  });

  router.post('/rabbit', async (ctx) => {
    await sendToRabbit(ctx.body);
    ctx.body = 'Sent to Rabbit';
  });

  router.post('/kafka', async (ctx) => {
    await sendToKafka(ctx.body);
    ctx.body = 'Sent to Kafka';
  });

  app.use(router.routes()).use(router.allowedMethods());

  return app;
}
