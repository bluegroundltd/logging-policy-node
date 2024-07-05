import KSUID from 'ksuid';

export async function sleep(waitInMs: number = Math.random() * 1000) {
  await new Promise((resolve) => setTimeout(resolve, waitInMs));
}

/**
 * Create a correlation id
 * Format: "version-timestamp-uniqueid"
 * @returns {string} correlation id
 */
export function genCorrelationId(version = '1') {
  const timestam = Date.now();
  const uniqueid = KSUID.randomSync().string;
  return `${version}-${timestam}-${uniqueid}`;
}

export function genRandomId() {
  return KSUID.randomSync().string;
}
