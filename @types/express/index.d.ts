import 'express';
import {MDC} from '@logger';

declare module '@types/express-serve-static-core' {
  interface Request {
    mdc: MDC;
  }

  interface Response {
    isLogged?: boolean;
  }
}
