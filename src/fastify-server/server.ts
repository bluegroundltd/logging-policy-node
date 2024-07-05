import fastifyCookie from '@fastify/cookie';
import fastifyExpress from '@fastify/express';
import fastifySession from '@fastify/session';
import Fastify, {FastifyBaseLogger, FastifyInstance} from 'fastify';
import {buggyOrder, createOrder, getOrders, getProducts} from '@service';
import {StatusCodes} from 'http-status-codes';
import {setupRequestContext} from './context.js';
import {logger, setupLogging} from './logging.js';
import {sendToRabbit} from 'rabbit/index.js';
import {sendToKafka} from 'kafka/index.js';

export async function createServer() {
  const app: FastifyInstance = Fastify({
    logger: logger.child(
      {logger: 'fastify-server'},
      {msgPrefix: '[http] '}
    ) as FastifyBaseLogger,
    connectionTimeout: 10_000,
    requestTimeout: 10_000,
    // Disable default request logging as we're using our custom logger
    disableRequestLogging: true
  });

  await app.register(fastifyExpress);
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'thismustbeoflength32charactersanditshouldnotbelessthanthat',
    cookie: {
      secure: process.env.NODE_ENV === 'production'
    }
  });

  // Setup MDC from request
  setupRequestContext(app);

  // Setup Logging
  setupLogging(app);

  // Middleware example
  app.addHook('preHandler', (req, res, done) => {
    req.mdc.set('meta', {random: Math.random()});
    done();
  });

  // Routes

  app.get('/', (req, res) => {
    res.send('Home');
  });

  /**
   * @api {post} /signin Sign in
   * @apiName SignIn
   * @apiGroup User
   *
   * @apiBody {String} email Email of the User.
   * @apiBody {String} password Password of the User.
   * @apiBody {String} [name] Name of the User.
   *
   * @apiSuccess {String} the encrypted session id.
   */
  app.post(
    '/signin',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            name: {type: 'string'},
            email: {type: 'string'},
            password: {type: 'string'}
          }
        }
      }
    },
    (req, res) => {
      const {name, email} = req.body as {
        name: string;
        email: string;
      };
      req.session.user = {
        name: name ?? 'John Doe',
        email,
        id: Math.round(Math.random() * 100)
      };
      res.send(req.session.encryptedSessionId);
    }
  );

  /**
   * @api {post} /signout Sign out
   * @apiName SignOut
   * @apiGroup User
   *
   * @apiSuccess {String} Signed out message.
   */
  app.post('/signout', async (req, res) => {
    await req.session.destroy();
    res.send('Signed out');
  });

  /**
   * @api {get} /products Get Products
   * @apiName GetProducts
   * @apiGroup Product
   *
   * @apiSuccess {Object[]} products List of products.
   */
  app.get('/products', () => {
    return getProducts();
  });

  /**
   * @api {get} /orders Get Orders
   * @apiName GetOrders
   * @apiGroup Order
   *
   * @apiSuccess {Object[]} orders List of orders.
   */
  app.get('/orders', async (req, res) => {
    if (!req.session.user) {
      res.status(StatusCodes.UNAUTHORIZED);
      res.send('Unauthorized');
      return;
    }
    const userId = req.session.user.id;
    return getOrders(userId);
  });

  /**
   * @api {post} /orders Create Order
   * @apiName CreateOrder
   * @apiGroup Order
   *
   * @apiBody {Number} productId Product ID.
   * @apiBody {Number} quantity Quantity of the product.
   *
   * @apiSuccess {Object} order The submitted Order.
   */
  app.post(
    '/orders',
    {
      schema: {
        body: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: {type: 'number'},
            quantity: {type: 'number'}
          }
        }
      }
    },
    async (req, res) => {
      if (!req.session.user) {
        res.status(StatusCodes.UNAUTHORIZED);
        res.send('Unauthorized');
        return;
      }
      const {productId, quantity} = req.body as {
        productId: number;
        quantity: number;
      };
      const userId = req.session.user.id;
      return createOrder({userId, productId, quantity});
    }
  );

  /**
   * @api {get} /error Error
   * @apiName Error
   * @apiGroup Error
   * @apiDescription This route is used to test error handling.
   *
   * @apiError {String} InternalServerError Internal Server Error.
   */
  app.get('/error', async () => {
    return buggyOrder();
  });

  app.post<{Body: Record<string, unknown>}>('/rabbit', async (req, res) => {
    await sendToRabbit(req.body);
    res.send('Sent to RabbitMQ');
  });

  app.post<{Body: Record<string, unknown>}>('/kafka', async (req, res) => {
    await sendToKafka(req.body);
    res.send('Sent to Kafka');
  });

  return app;
}
