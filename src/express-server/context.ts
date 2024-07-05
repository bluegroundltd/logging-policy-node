import {AsyncResource} from 'node:async_hooks';
import {Express} from 'express';
import KSUID from 'ksuid';
import {MDCStore, MDC, mdc as _mdc} from '@logger';
import {genCorrelationId} from 'helpers.js';

export function setupRequestContext(app: Express, mdc: MDC = _mdc) {
  app.use((req, res, next) => {
    const requestId = KSUID.randomSync().string;
    const entrypoint = 'http/api';
    const correlationId =
      req.header('x-correlation-id') ||
      req.header('x-amzn-trace-id') ||
      genCorrelationId();

    const clientId = req.header('x-client-id');
    const clientName = req.header('x-client-name');
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

    req.mdc = mdc;

    mdc.run(store, () => {
      const asyncResource = new AsyncResource('express-request');
      asyncResource.runInAsyncScope(next, req);
    });
  });
}
