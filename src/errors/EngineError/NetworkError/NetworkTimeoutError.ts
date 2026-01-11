import { NetworkError } from './BaseError'

/**
 * 网络超时错误
 */
export class NetworkTimeoutError extends NetworkError {
  constructor(url: string, timeout: number) {
    super(url, `Network timeout after ${timeout}ms: ${url}`, {})
  }

  override toUserMessage(): string {
    return '网络请求超时，请检查网络连接后重试。'
  }
}
