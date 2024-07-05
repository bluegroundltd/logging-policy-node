import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    requestTime?: number;
  }
}
