import {AsyncResource} from 'node:async_hooks';
import {FastifyInstance} from 'fastify';
import {stringifyHeader} from './helpers.js';
import {genCorrelationId} from 'helpers.js';
import {MDC, MDCStore, mdc as _mdc} from '@logger';

export function setupRequestContext(app: FastifyInstance, mdc: MDC = _mdc) {
  app.decorateRequest('mdc', {
    getter() {
      return mdc;
    }
  });

  app.addHook('onRequest', (req, res, done) => {
    const entrypoint = 'http/api';
    const requestId = req.id;
    const correlationId =
      stringifyHeader(req, 'X-Correlation-Id') ||
      stringifyHeader(req, 'X-Amzn-Trace-Id') ||
      genCorrelationId();
    const clientId = stringifyHeader(req, 'X-Client-Id');
    const clientName = stringifyHeader(req, 'X-Client-Name');
    const user = req.session?.user;

    const store: Partial<MDCStore> = {
      correlationId,
      entrypoint,
      requestId,
      user
    };

    if (clientId || clientName) {
      store.clientInfo = {
        id: clientId,
        name: clientName
      };
    }

    mdc.run(store, () => {
      const asyncResource = new AsyncResource('fastify-request');
      asyncResource.runInAsyncScope(done, req.raw);
    });
  });
}
