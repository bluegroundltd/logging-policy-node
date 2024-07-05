import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';
import type {HttpAttributes, NetworkAttributes, UrlDetails} from './types.js';

import {StatusCodes} from 'http-status-codes';
import {baseLogger} from './logger.js';
import {mdc} from '@logger';
import {genCorrelationId} from 'helpers.js';

const logger = baseLogger.child({logger: 'axios'});

function getUrlDetails(url: string, baseUrl?: string): UrlDetails {
  const urlObj = new URL(url, baseUrl);
  return {
    host: urlObj.hostname,
    path: urlObj.pathname,
    queryString: Object.fromEntries(urlObj.searchParams.entries()),
    port: urlObj.port ? parseInt(urlObj.port) : undefined,
    scheme: urlObj.protocol.replace(':', '')
  };
}

function getHttpAttributes(
  config: InternalAxiosRequestConfig,
  response?: AxiosResponse
): HttpAttributes {
  const urlDetails = getUrlDetails(config.url!, config.baseURL);
  const method = config.method?.toUpperCase() || 'GET';
  const status = response?.status;

  return {
    method,
    status_code: status,
    url_details: urlDetails,
    url: config.url!,
    version: config.httpAgent?.version,
    useragent: config.httpAgent?.userAgent,
    headers: config.headers
  };
}

function getNetworkAttributes(response: AxiosResponse): NetworkAttributes {
  const {config} = response;
  const bytesRead = response.headers['content-length'];
  const bytesWritten = config.data
    ? JSON.stringify(config.data).length
    : undefined;
  const {host, port} = getUrlDetails(config.url!, config.baseURL);
  return {
    bytes_read: bytesRead,
    bytes_written: bytesWritten,
    destination: {
      ip: host,
      port
    }
  };
}

function axiosRequestLogger(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  const {host, path} = getUrlDetails(config.url!, config.baseURL);
  const http = getHttpAttributes(config);
  logger.info({http}, `-> [req] [${host}] ${http.method} ${path}`);
  return config;
}

function axiosResponseLogger(response: AxiosResponse): AxiosResponse {
  const {config, status, statusText} = response;
  const {host, path} = getUrlDetails(config.url!, config.baseURL);
  const http = getHttpAttributes(config);
  const network = getNetworkAttributes(response);
  const duration = Date.now() - config.requestTime!;

  logger.info(
    {http, network, duration},
    `<- [res] [${host}] ${http.method} ${path} ${status} ${statusText} (${duration}ms)`
  );
  return response;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function axiosErrorLogger(error: any): Promise<Error> {
  if (!error.config) {
    logger.error({err: error}, error.message);
    return Promise.reject(error);
  }

  const {config, response} = error as {
    config: InternalAxiosRequestConfig;
    response: AxiosResponse;
  };

  const {host, path} = getUrlDetails(config.url!, config.baseURL);
  const http = getHttpAttributes(config);
  const network = response && getNetworkAttributes(response);
  const duration = Date.now() - config.requestTime!;
  const logCtx = {http, network, duration};
  const status = response?.status;
  const message = response
    ? `<- [res] [${host}] ${http.method} ${path} ${status} (${duration}ms)`
    : `-> [req] [${host}] ${http.method} ${path}`;

  if (
    typeof status === 'number' &&
    status < StatusCodes.INTERNAL_SERVER_ERROR
  ) {
    logger.warn(logCtx, message);
  } else {
    logger.error(logCtx, message);
  }

  return Promise.reject(error);
}

function requestTimeInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  config.requestTime = Date.now();
  return config;
}

function xCorrelationIdInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  const correlationId = mdc.safeGet('correlationId', genCorrelationId());
  config.headers['x-correlation-id'] = correlationId;
  return config;
}

export function setupAxiosLogging(instance: AxiosInstance) {
  instance.interceptors.request.use(requestTimeInterceptor);
  instance.interceptors.request.use(axiosRequestLogger);
  instance.interceptors.request.use(xCorrelationIdInterceptor);
  instance.interceptors.response.use(axiosResponseLogger, axiosErrorLogger);
}
