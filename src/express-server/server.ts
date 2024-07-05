import express from 'express';
import session from 'express-session';
import responseTime from 'response-time';
import cookieParser from 'cookie-parser';
import {StatusCodes} from 'http-status-codes';
import {buggyOrder, getProducts, getOrders, createOrder} from '@service';
import {setupRequestContext} from './context.js';
import {
  logIncomingRequests,
  logOutgoingResponses,
  logErrors
} from './logging.js';
import {sendToRabbit} from 'rabbit/index.js';
import {sendToKafka} from 'kafka/index.js';

export function createServer() {
  const app = express();

  app.use(responseTime({suffix: false, digits: 0}));
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: 'thismustbeoflength32charactersanditshouldnotbelessthanthat',
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production'
      }
    })
  );

  // Setup MDC from request
  setupRequestContext(app);

  // Setup Logging
  app.use(logIncomingRequests);
  app.use(logOutgoingResponses);

  // Middleware
  app.use((req, res, next) => {
    req.mdc.set('meta', {random: Math.random()});
    next();
  });

  // Routes
  app.get('/', (req, res) => {
    res.send('Home');
  });

  app.post('/signin', (req, res) => {
    const {name, email} = req.body as {
      name: string;
      email: string;
    };

    req.session.user = {
      name: name ?? 'John Doe',
      email,
      id: Math.round(Math.random() * 100)
    };
    res.send(req.sessionID);
  });

  app.post('/signout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send('Error signing out');
      }
      res.send('Signed out');
    });
  });

  app.get('/products', async (req, res) => {
    const products = await getProducts();
    res.json(products);
  });

  app.get('/orders', async (req, res) => {
    if (!req.session.user) {
      return res.status(StatusCodes.UNAUTHORIZED).send();
    }
    const orders = await getOrders(req.session.user.id);
    res.json(orders);
  });

  app.post('/orders', async (req, res) => {
    if (!req.session.user) {
      return res.status(StatusCodes.UNAUTHORIZED).send();
    }
    const {productId, quantity} = req.body as {
      productId: number;
      quantity: number;
    };
    const userId = req.session.user.id;
    const orders = await createOrder({userId, productId, quantity});
    res.json(orders);
  });

  app.get('/error', (req, res) => {
    const error = buggyOrder();
    res.json(error);
  });

  app.post('/rabbit', async (req, res) => {
    await sendToRabbit(req.body);
    res.send('Sent to Rabbit');
  });

  app.post('/kafka', async (req, res) => {
    await sendToKafka(req.body);
    res.send('Sent to Kafka');
  });

  app.use(logErrors);

  app.use(function errorHandler(
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (res.headersSent) {
      return next(err);
    }
    res.status(500);
    res.send('Server Error');
  });

  return app;
}
