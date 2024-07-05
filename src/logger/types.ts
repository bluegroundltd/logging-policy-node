export interface UserAgentDetails {
  os: {
    family?: string;
  };
  browser: {
    family?: string;
    version?: string;
  };
  device: {
    family?: string;
  };
}

export interface UrlDetails {
  host: string;
  path: string;
  queryString: Record<string, unknown>;
  port: number | undefined;
  scheme: string;
}

export interface HttpAttributes {
  method: string;
  referer?: string;
  status_code?: number;
  url_details: UrlDetails;
  url: string;
  useragent_details?: UserAgentDetails;
  useragent?: string;
  version: string;
  headers: Record<string, unknown>;
}

export interface NetworkAttributes {
  bytes_read?: number;
  bytes_written?: number;
  client?: {
    ip?: string;
    port?: number;
    internal_ip?: string;
    geoip?: {
      country: {
        iso_code: string;
      };
    };
  };
  destination?: {
    ip?: string;
    port?: number;
  };
}
