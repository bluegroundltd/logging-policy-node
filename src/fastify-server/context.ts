import {AsyncResource} from 'node:async_hooks';
import {FastifyInstance} from 'fastify';
import {genCorrelationId} from 'helpers.js';
import {stringifyHeader} from './helpers.js';
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
      stringifyHeader(req, 'x-correlation-id') ||
      stringifyHeader(req, 'x-amzn-trace-id') ||
      genCorrelationId();
    const clientId = stringifyHeader(req, 'x-client-id');
    const clientName = stringifyHeader(req, 'x-client-name');
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
