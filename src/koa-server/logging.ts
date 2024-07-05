import Koa, {Context, Next} from 'koa';
import UAParser from 'ua-parser-js';
import {StatusCodes} from 'http-status-codes';
import {
  HttpAttributes,
  NetworkAttributes,
  UrlDetails,
  UserAgentDetails,
  baseLogger,
  loggerBindings,
  mdc
} from '@logger';
import { genCorrelationId } from 'helpers.js';

export {baseLogger as logger, baseLogger, loggerBindings};

const logger = baseLogger.child({logger: 'koa-server'});

function getUserAgentDetails(userAgent?: string): UserAgentDetails | undefined {
  if (!userAgent) {
    return undefined;
  }
  const ua = new UAParser(userAgent).getResult();
  return {
    os: {
      family: ua.os.name
    },
    browser: {
      family: ua.browser.name,
      version: ua.browser.version
    },
    device: {
      family: ua.device.type
    }
  };
}

function buildHttpAttributes(ctx: Context): HttpAttributes {
  const {method, url, headers, hostname, protocol, query, req} = ctx;
  const localPort = ctx.socket.localPort;
  const {
    referer,
    'user-agent': userAgent,
    'x-forwarded-proto': forwardedProtocol
  } = headers;

  const scheme = (forwardedProtocol as string) || protocol;

  const urlDetails: UrlDetails = {
    host: hostname,
    path: url,
    queryString: query as Record<string, unknown>,
    port: localPort,
    scheme
  };

  const userAgentDetails = getUserAgentDetails(userAgent);

  let http: HttpAttributes = {
    method,
    headers,
    referer,
    url_details: urlDetails,
    url,
    useragent: userAgent,
    useragent_details: userAgentDetails,
    version: req.httpVersion
  };

  if (ctx.status) {
    http = {
      ...http,
      status_code: ctx.status
    };
  }

  return http;
}

function buildNetworkAttributes(ctx: Context): NetworkAttributes | undefined {
  const {socket, headers} = ctx;
  const {bytesRead, bytesWritten, remoteAddress, remotePort} = socket;
  const {
    'cf-ipcountry': countryCode,
    'cf-connecting-ip': connectedIP,
    'x-forwarded-for': forwardedIP,
    'x-forwarded-port': forwardedPort
  } = headers;

  const ip =
    (Array.isArray(connectedIP) ? connectedIP.join(',') : connectedIP) ||
    (Array.isArray(forwardedIP) ? forwardedIP.join(',') : forwardedIP) ||
    remoteAddress;

  const port = Number((forwardedPort as string) || remotePort);

  const geoip = countryCode
    ? {country: {iso_code: countryCode as string}}
    : undefined;

  return {
    bytes_read: bytesRead,
    bytes_written: bytesWritten,
    client: {
      ip,
      port,
      internal_ip: remoteAddress,
      geoip
    }
  };
}

async function logIncomingRequests(ctx: Context, next: Next) {
  const {method, url} = ctx;
  const http = buildHttpAttributes(ctx);
  const network = buildNetworkAttributes(ctx);
  const attributes = {http, network};
  const msg = `[req] ${method} ${url}`;

  logger.info(attributes, msg);
  await next();
}

async function logOutgoingResponses(ctx: Context, next: Next) {
  // We need to provide correlationId to the function
  // as listeners run on a different context, and as
  // a result, they do not have access to the mdc store.
  function onResponse(correlationId: string) {
    ctx.res.off('close', onResponse);

    const {method, url, status} = ctx;
    const http = buildHttpAttributes(ctx);
    const network = buildNetworkAttributes(ctx);
    const duration = Number(ctx.response.get('X-Response-Time'));
    const attributes = {correlation_id: correlationId, http, network, duration, err: ctx.state.err};
    const msg = `[res] ${method} ${url} ${status} (${duration}ms)`;

    if (status >= StatusCodes.INTERNAL_SERVER_ERROR) {
      logger.error(attributes, msg);
    } else {
      logger.info(attributes, msg);
    }
  }

  const correlationId = mdc.safeGet('correlationId', genCorrelationId()) as unknown as string;

  ctx.res.once('close', () => {
    onResponse(correlationId);
  });

  await next();
}

export function setupLogging(app: Koa): void {
  app.on('error', (err, ctx) => {
    ctx.state.err = err;
  });
  app.use(logIncomingRequests);
  app.use(logOutgoingResponses);
  // TODO: Log timeouts
}
