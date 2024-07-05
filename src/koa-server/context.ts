import {AsyncResource} from 'node:async_hooks';
import Koa from 'koa';
import KSUID from 'ksuid';
import {MDCStore, MDC, mdc as _mdc} from '@logger';
import {genCorrelationId} from 'helpers.js';

export function setupRequestContext(app: Koa, mdc: MDC = _mdc) {
  app.context.mdc = mdc;

  app.use(async (ctx, next) => {
    const requestId = KSUID.randomSync().string;
    const entrypoint = 'http/api';
    const correlationId =
      ctx.get('x-correlation-id') ||
      ctx.get('x-amzn-trace-id') ||
      genCorrelationId();

    const clientId = ctx.get('x-client-id');
    const clientName = ctx.get('x-client-name');
    const user = ctx.session?.user;

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

    await new Promise((resolve, reject) => {
      mdc.run(store, () => {
        const asyncResource = new AsyncResource('koa-request');
        asyncResource.runInAsyncScope(() => {
          next().then(resolve, reject);
        }, ctx);
      });
    });
  });
}
