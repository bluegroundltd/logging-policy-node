import {mdc} from '@logger';
import axios from 'axios';
import {setupAxiosLogging} from 'logger/axios.js';

export const httpBunClient = axios.create({
  baseURL: 'https://httpbun.com',
  headers: {
    'Content-Type': 'application/json'
  }
});

httpBunClient.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = mdc.safeGet('correlationId');
  return config;
});

setupAxiosLogging(httpBunClient);
