import {baseLogger, loggerBindings} from '@logger';
import {sleep} from 'helpers.js';

const logger = baseLogger.child(loggerBindings(import.meta.url));

export function getProducts(): Promise<Record<string, unknown>[]> {
  return sleep(10).then(() => {
    logger.info('Fetched products');
    return [
      {
        id: 1,
        name: 'Product 1',
        price: 100
      },
      {
        id: 2,
        name: 'Product 2',
        price: 200
      }
    ];
  });
}
