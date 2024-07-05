import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import UAParser from 'ua-parser-js';
import {StatusCodes} from 'http-status-codes';
import {
  HttpAttributes,
  NetworkAttributes,
  UrlDetails,
  UserAgentDetails,
  logger,
  loggerBindings
} from '@logger';

export {logger, loggerBindings};

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

function buildHttpAttributes(
  req: FastifyRequest,
  res?: FastifyReply
): HttpAttributes {
  const {method, url, headers, raw, hostname, protocol, query} = req;
  const localPort = req.socket.localPort;
  const {
    referer,
    'user-agent': userAgent,
    'x-forwarded-proto': forwardedProtocol
  } = headers;
  const {httpVersion} = raw;

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

function buildNetworkAttributes(
  req: FastifyRequest
): NetworkAttributes | undefined {
  const {socket} = req.raw;
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

/**
 * Add a pre-validation hook to log incoming requests
 *
 * Notice: Why not use onRequest hook?
 * In the onRequest hook, request.body will always be undefined,
 * because the body parsing happens before the preValidation hook.
 *
 * @param app - the fastify instance
 */
function logIncomingRequests(app: FastifyInstance): void {
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const {method, url} = req;
    const http = buildHttpAttributes(req);
    const network = buildNetworkAttributes(req);
    const attributes = {http, network};
    const msg = `[req] ${method} ${url}`;

    req.log.info(attributes, msg);
  });
}

function logOutgoingResponses(app: FastifyInstance): void {
  app.addHook('onResponse', async (req: FastifyRequest, res: FastifyReply) => {
    if (res.isLogged) {
      return;
    }

    const {method, url} = req;
    const {statusCode} = res;
    const http = buildHttpAttributes(req, res);
    const network = buildNetworkAttributes(req);
    const duration = Math.round(res.elapsedTime);
    const attributes = {http, network, duration};
    const msg = `[res] ${method} ${url} ${statusCode} (${duration}ms)`;

    req.log.info(attributes, msg);
  });
}

function logTimeouts(app: FastifyInstance): void {
  app.addHook('onTimeout', async (req: FastifyRequest, res: FastifyReply) => {
    const {method, url} = req;
    const http = buildHttpAttributes(req, res);
    const network = buildNetworkAttributes(req);
    const msg = `[res] ${method} ${url} (TIMEOUT)`;

    req.log.error({http, network}, msg);
  });
}

function logErrors(app: FastifyInstance): void {
  app.addHook(
    'onError',
    async (req: FastifyRequest, res: FastifyReply, err) => {
      if (res.statusCode < StatusCodes.INTERNAL_SERVER_ERROR) {
        res.code(StatusCodes.INTERNAL_SERVER_ERROR);
      }
      const {method, url} = req;
      const {statusCode} = res;
      const http = buildHttpAttributes(req, res);
      const network = buildNetworkAttributes(req);
      const msg = `[res] ${method} ${url} ${statusCode}`;
      res.isLogged = true;
      req.log.error({http, network, err}, msg);
    }
  );
}

/**
 * Setup logging for the Fastify app
 *
 * - Log incoming requests
 * - Log outgoing responses
 * - Log errors
 * - Log timeouts
 *
 * @param app - the fastify app
 */
export function setupLogging(app: FastifyInstance): void {
  app.decorateReply('isLogged', false);

  logIncomingRequests(app);
  logOutgoingResponses(app);
  logTimeouts(app);
  logErrors(app);
}
