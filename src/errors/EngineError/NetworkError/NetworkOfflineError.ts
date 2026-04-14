import { NetworkError } from './BaseError'

/**
 * 网络离线错误
 */
export class NetworkOfflineError extends NetworkError {
  constructor(url: string) {
    super(url, `Network offline: ${url}`, {})
  }

  override toUserMessage(): string {
    return '网络连接已断开，请检查网络后重试。'
  }
}
