import {FastifyRequest} from 'fastify';

export function stringifyHeader(
  req: FastifyRequest,
  headerName: string,
  delim = ','
) {
  const value = req.headers[headerName];
  return Array.isArray(value) ? value.join(delim) : value;
}
