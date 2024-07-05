/* eslint-disable @typescript-eslint/no-explicit-any */
import 'fastify';
import {MDC} from '@logger';

declare module 'fastify' {
  interface FastifyRequest {
    mdc: MDC;
  }

  interface FastifyReply {
    isLogged?: boolean;
  }

  interface Session {
    user?: {
      name: string;
      email: string;
      id: number;
    };
  }
}
