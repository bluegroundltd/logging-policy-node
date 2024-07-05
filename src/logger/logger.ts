/**
 * Logger module
 *
 * @module logger
 */

import {pino} from 'pino';
import {mdc} from './mdc.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const formatters = {
  level: (label: string, level: number) => ({level, status: label})
};

function mixin() {
  const {
    clientInfo: clientinfo,
    correlationId: correlation_id,
    entrypoint,
    requestId: request_id,
    user: usr,
    meta
  } = mdc.getCopyOfStore();

  return {
    clientinfo,
    correlation_id,
    entrypoint,
    meta,
    request_id,
    usr
  };
}

export function loggerBindings(fileurl: string) {
  const cwd = process.cwd();
  const filepath = fileURLToPath(fileurl);
  return {
    logger: path.relative(cwd, filepath)
  };
}

export const logger = pino({
  formatters,
  mixin,
  level: process.env.LOG_LEVEL || 'info',
  enabled: process.env.LOG_DISABLED !== 'yes'
});

export const baseLogger = logger;
