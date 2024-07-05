import 'pino';
import {AsyncLocalStorage} from 'async_hooks';

declare module 'pino' {
  interface BaseLogger {
    asl?: AsyncLocalStorage<object>;
    setAsl(asl: AsyncLocalStorage<object>);
  }
}
