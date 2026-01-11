import { NetworkTimeoutError } from '@/errors/EngineError/NetworkError/NetworkTimeoutError'

interface FetchOption extends RequestInit {
  timeout: number
}

/**
 * 带超时的fetch
 */
export async function fetchWithTimeout(url: string, options: FetchOption): Promise<Response> {
  const { timeout = 6000, ...fetchOptions } = options

  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...fetchOptions
    })

    return response
  } catch (error) {
    // 超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkTimeoutError(url, timeout)
    }

    // 其他网络错误（TypeError: Failed to fetch）
    throw error
  } finally {
    clearTimeout(timerId)
  }
}
