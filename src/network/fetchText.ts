import { HttpError } from '@/errors/EngineError/NetworkError/HTTPError'
import { fetchWithTimeout } from './http'
import { FetchOptions } from './types/fetch-options'
import { NetworkError } from '@/errors/EngineError/NetworkError/BaseError'

/**
 * 获取文本内容（处理 HTTP 状态）
 *
 * 职责：
 * - 检查 HTTP 状态码
 * - 解析为文本
 * - 抛出对应的 HTTP 错误
 */
export async function fetchTextWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  try {
    const response = await fetchWithTimeout(url, options)

    // const DEBUG_FUNCTION_NAME = 'fetchTextWithTimeout'

    // 判断 HTTP 状态
    if (!response.ok) {
      throw new HttpError(url, response.status, response.statusText)
    }

    const contentType = response.headers.get('content-type') ?? ''
    // console.debug(`[${DEBUG_FUNCTION_NAME}] ${contentType}`)
    if (contentType.includes('text/html')) {
      throw new HttpError(
        url,
        404,
        'Expected text file but got HTML (likely SPA fallback — file does not exist)'
      )
    }

    return await response.text()
  } catch (error) {
    // 如果已经是网络错误，包括 网络层 和 HTTP 层，以及 用户主动取消请求的 Abort Error，则直接抛出
    if (error instanceof NetworkError || (error instanceof Error && error.name === 'AbortError')) {
      throw error
    }

    // 防御性编程，可能抛出 response.text() 相关错误，需要上层处理
    throw new NetworkError(url, error instanceof Error ? error.message : 'Unknown error')
  }
}
