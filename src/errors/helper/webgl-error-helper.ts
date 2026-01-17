/**
 * WebGL 错误处理工具
 *
 * 提供 WebGL 错误检查和消息转换的辅助函数
 */

/**
 * 将 WebGL 错误码转换为可读消息
 *
 * @param error - gl.getError() 返回的错误码
 * @param gl - WebGL 上下文
 * @returns 可读的错误消息
 *
 * @example
 * ```ts
 * gl.texImage2D(...)
 * const error = gl.getError()
 * if (error !== gl.NO_ERROR) {
 *   const message = getWebGLErrorMessage(error, gl)
 *   console.error('WebGL Error:', message)
 * }
 * ```
 */
export function getWebGLErrorMessage(error: number, gl: WebGLRenderingContext): string {
  switch (error) {
    case gl.INVALID_ENUM:
      return 'INVALID_ENUM: 参数不是合法的枚举值'
    case gl.INVALID_VALUE:
      return 'INVALID_VALUE: 参数值超出范围'
    case gl.INVALID_OPERATION:
      return 'INVALID_OPERATION: 当前状态下操作不合法'
    case gl.INVALID_FRAMEBUFFER_OPERATION:
      return 'INVALID_FRAMEBUFFER_OPERATION: Framebuffer未完成'
    case gl.OUT_OF_MEMORY:
      return 'OUT_OF_MEMORY: GPU内存不足'
    default:
      return `Unknown WebGL error: 0x${error.toString(16)}`
  }
}

/**
 * 检查 WebGL 错误并抛出异常
 *
 * @param gl - WebGL 上下文
 * @param operation - 操作名称（用于错误消息）
 * @throws Error 如果存在 WebGL 错误
 *
 * @example
 * ```ts
 * gl.texImage2D(...)
 * checkWebGLError(gl, 'gl.texImage2D')
 * ```
 */
export function checkWebGLError(gl: WebGLRenderingContext, operation: string) {
  const error = gl.getError()

  if (error !== gl.NO_ERROR) {
    const errorMessgae = getWebGLErrorMessage(error, gl)
    throw new Error(`${operation} failed: ${errorMessgae}`)
  }
}

/**
 * 获取所有待处理的 WebGL 错误
 *
 * @param gl - WebGL 上下文
 * @returns 错误消息数组
 *
 * @remarks
 * WebGL 错误是累积的，需要多次调用 getError() 清空错误队列
 *
 * @example
 * ```ts
 * const errors = getAllWebGLErrors(gl)
 * if (errors.length > 0) {
 *   console.error('WebGL Errors:', errors)
 * }
 * ```
 */
export function getAllWebGLError(gl: WebGLRenderingContext): string[] {
  const errors: string[] = []

  let error = gl.getError()

  while (error !== gl.NO_ERROR) {
    errors.push(getWebGLErrorMessage(error, gl))

    error = gl.getError()

    // 防止无限循环
    if (errors.length > 100) {
      errors.push('Too many errors (> 100)')
      break
    }
  }

  return errors
}

/**
 * 清空所有 WebGL 错误
 *
 * @param gl - WebGL 上下文
 * @returns 被清空的错误数量
 *
 * @example
 * ```ts
 * const clearedCount = clearWebGLErrors(gl)
 * console.log(`Cleared ${clearedCount} errors`)
 * ```
 */
