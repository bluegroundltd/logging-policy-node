import {Request, Response, NextFunction, Application} from 'express';
import UAParser from 'ua-parser-js';
import {StatusCodes} from 'http-status-codes';
import {
  HttpAttributes,
  NetworkAttributes,
  UrlDetails,
  UserAgentDetails,
  baseLogger,
  loggerBindings
} from '@logger';

export {baseLogger as logger, baseLogger, loggerBindings};

const logger = baseLogger.child({logger: 'express-server'});

interface CustomResponse extends Response {
  isLogged?: boolean;
}

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

function buildHttpAttributes(req: Request, res?: Response): HttpAttributes {
  const {method, url, headers, hostname, protocol, query, httpVersion} = req;
  const localPort = req.socket.localPort;
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
    referer,
    url_details: urlDetails,
    url,
    useragent: userAgent,
    useragent_details: userAgentDetails,
    version: httpVersion
  };

  if (res) {
    const {statusCode} = res;
    http = {
      ...http,
      status_code: statusCode
    };
  }

  return http;
}

function buildNetworkAttributes(req: Request): NetworkAttributes | undefined {
  const {socket} = req;
  const {bytesRead, bytesWritten, remoteAddress, remotePort} = socket;
  const {
    'cf-ipcountry': countryCode,
    'cf-connecting-ip': connectedIP,
    'x-forwarded-for': forwardedIP,
    'x-forwarded-port': forwardedPort
  } = req.headers;

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

function logIncomingRequests(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const {method, url} = req;
  const http = buildHttpAttributes(req);
  const network = buildNetworkAttributes(req);
  const attributes = {http, network};
  const msg = `[req] ${method} ${url}`;

  logger.info(attributes, msg);
  next();
}

function logOutgoingResponses(
  req: Request,
  res: CustomResponse,
  next: NextFunction
): void {
  res.on('finish', () => {
    if (res.isLogged) {
      return;
    }

    const {method, url} = req;
    const {statusCode} = res;
    const http = buildHttpAttributes(req, res);
    const network = buildNetworkAttributes(req);
    const duration = res.getHeader('X-Response-Time');
    const attributes = {http, network, duration};
    const msg = `[res] ${method} ${url} ${statusCode}`;

    logger.info(attributes, msg);
  });

  next();
}

function logTimeouts(
  req: Request,
  res: CustomResponse,
  next: NextFunction
): void {
  req.setTimeout(5000, () => {
    const {method, url} = req;
    const http = buildHttpAttributes(req, res);
    const network = buildNetworkAttributes(req);
    const msg = `[res] ${method} ${url} (TIMEOUT)`;

    logger.error({http, network}, msg);
  });

  next();
}

function logErrors(
  err: Error,
  req: Request,
  res: CustomResponse,
  next: NextFunction
): void {
  if (res.statusCode < StatusCodes.INTERNAL_SERVER_ERROR) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
  }
  const {method, url} = req;
  const {statusCode} = res;
  const http = buildHttpAttributes(req, res);
  const network = buildNetworkAttributes(req);
  const msg = `[res] ${method} ${url} ${statusCode}`;
  res.isLogged = true;
  logger.error({http, network, err}, msg);
  next(err);
}

export function setupLogging(app: Application): void {
  app.use((req: Request, res: CustomResponse, next: NextFunction) => {
    res.isLogged = false;
    next();
  });
  app.use(logIncomingRequests);
  app.use(logOutgoingResponses);
  app.use(logTimeouts);
  app.use(logErrors);
}
