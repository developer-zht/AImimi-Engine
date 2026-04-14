import { NetworkTimeoutError } from '@/errors/EngineError/NetworkError/NetworkTimeoutError'
import { FetchOptions } from './types/fetch-options'
import { NetworkError } from '@/errors/EngineError/NetworkError/BaseError'

/**
 * 带超时的fetch
 *
 * 默认 6000 ms 超时
 */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = 6000, ...fetchOptions } = options

  const controller = new AbortController()

  const timerId = setTimeout(() => {
    controller.abort()
  }, timeout)

  // 如果用户传了自己的 signal，就监听传入的 signal 来同步 abort
  if (fetchOptions.signal) {
    fetchOptions.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions, // ...fetchOptions 在上，避免 fetchOptions 中的 signal 覆盖下面的自定义的 signal
      signal: controller.signal
    })

    return response
  } catch (error) {
    // 超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      // 区分：用户取消 vs 超时
      if (fetchOptions.signal?.aborted) {
        // 用户主动取消（不是错误），直接往上抛出
        throw error
      }
      throw new NetworkTimeoutError(url, timeout)
    }

    // 网络连接失败（断网、DNS 错误、CORS 等）
    if (error instanceof TypeError) {
      throw new NetworkError(url, `Network error: ${error.message}`)
    }

    // 其他网络错误
    throw new NetworkError(url, error instanceof Error ? error.message : 'Unknown network error')
  } finally {
    clearTimeout(timerId)
  }
}
