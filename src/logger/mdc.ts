import {MDC} from '@bluegroundltd/async-mdc';
export {MDC};

export interface MDCStore extends Record<string, unknown> {
  clientInfo?: {
    id?: string;
    name?: string;
  };
  correlationId?: string;
  entrypoint?: string;
  requestId?: string;
  user?: {
    id: string | number;
    name?: string;
    email?: string;
  };
  meta?: Record<string, unknown>;
}

export const mdc = new MDC<MDCStore>();
