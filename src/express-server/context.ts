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
      req.header('X-Correlation-Id') ||
      req.header('X-Amzn-Trace-Id') ||
      genCorrelationId();

    const clientId = req.header('X-Client-Id');
    const clientName = req.header('X-Client-Name');
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
