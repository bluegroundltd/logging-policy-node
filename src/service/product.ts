import {baseLogger, loggerBindings} from '@logger';
import {sleep} from 'helpers.js';

const logger = baseLogger.child(loggerBindings(import.meta.url));

export interface Product {
  id: number;
  name: string;
  price: number;
}

export async function getProducts(): Promise<Product[]> {
  await sleep(10);

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
}
