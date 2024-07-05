import asyncHooks, {AsyncResource} from 'async_hooks';
import {logger} from '@logger';

interface AsyncResourceMeta {
  asyncId: number;
  type: string;
  pAsyncId: number;
  res: AsyncResource;
}

export default (...types: string[]) => {
  const tracked: Record<number, AsyncResourceMeta> = {};

  const asyncHook = asyncHooks.createHook({
    init: (asyncId, type, triggerAsyncId, resource) => {
      if (types?.length === 0 || types.includes(type)) {
        const meta: AsyncResourceMeta = {
          asyncId,
          type,
          pAsyncId: triggerAsyncId,
          res: resource as AsyncResource
        };
        tracked[asyncId] = meta;
        printMeta('init', meta);
      }
    },
    before: (asyncId) => {
      const meta = tracked[asyncId];
      if (meta) printMeta('before', meta);
    },
    after: (asyncId) => {
      const meta = tracked[asyncId];
      if (meta) printMeta('after', meta);
    },
    destroy: (asyncId) => {
      const meta = tracked[asyncId];
      if (meta) printMeta('destroy', meta);
      // delete meta for the event
      delete tracked[asyncId];
    },
    promiseResolve: (asyncId) => {
      const meta = tracked[asyncId];
      if (meta) printMeta('promiseResolve', meta);
    }
  });

  asyncHook.enable();

  function printMeta(eventName: string, meta: AsyncResourceMeta) {
    logger.debug(
      `[${eventName}]
      \t asyncId=${meta.asyncId}
      \t type=${meta.type}
      \t pAsyncId=${meta.pAsyncId}
      \t res=${meta.res.constructor.name}
      `
    );
  }
};
