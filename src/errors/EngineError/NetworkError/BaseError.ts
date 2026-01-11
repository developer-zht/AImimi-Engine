import { EngineError } from '../BaseError'

/**
 * 网络错误基类
 */
export class NetworkError extends EngineError {
  public readonly url: string
  public readonly httpStatus?: number

  constructor(
    url: string,
    message: string,
    options: {
      httpStatus?: number
      cause?: Error
    } = {}
  ) {
    super(message, 'NETWORK_ERROR', {
      context: {
        url,
        httpStatus: options.httpStatus
      },
      recoverable: true, // 网络错误通常可以重试
      cause: options.cause
    })

    this.url = url
    this.httpStatus = options.httpStatus
  }
}
