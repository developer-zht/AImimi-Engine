export class JacobianAnalyzer {
  /**
   * 读取 WebGL 纹理的 RGBA 数据
   * @param gl WebGL 上下文
   * @param texture 要读取的纹理
   * @param width 纹理宽度
   * @param height 纹理高度
   * @returns Float32Array，格式为 [r0, g0, b0, a0, r1, g1, b1, a1, ...]
   */
  private readTextureData(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    width: number,
    height: number
  ): Float32Array {
    // 创建临时 FBO
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    // 绑定纹理到 FBO
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

    // 检查 FBO 状态
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer incomplete:', status)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.deleteFramebuffer(fbo)
      return new Float32Array(0)
    }

    // 读取像素数据
    const pixels = new Float32Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels)

    // 清理
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)

    return pixels
  }

  /**
   * 统计 Jacobian 纹理的数值分布
   * @param gl WebGL 上下文
   * @param jacobTexture Jacobian 纹理（RGBA = dDx_dx, dDz_dz, dDx_dz, dDz_dx）
   * @param width 纹理宽度
   * @param height 纹理高度
   */
  analyzeJacobianTexture(
    gl: WebGLRenderingContext,
    jacobTexture: WebGLTexture,
    width: number,
    height: number
  ) {
    console.log('🔍 开始分析 Jacobian 纹理...')

    // 读取纹理数据
    const pixels = this.readTextureData(gl, jacobTexture, width, height)
    if (pixels.length === 0) {
      console.error('❌ 无法读取纹理数据')
      return
    }

    // 统计变量
    const jacobianValues: number[] = []
    let minJ = Infinity
    let maxJ = -Infinity
    let sumJ = 0

    // 分布统计（区间计数）
    const bins = {
      negative: 0, // J < 0
      veryLow: 0, // 0 ≤ J < 0.3
      low: 0, // 0.3 ≤ J < 0.6
      medium: 0, // 0.6 ≤ J < 1.0
      normal: 0, // 1.0 ≤ J < 1.3
      high: 0, // 1.3 ≤ J < 1.8
      veryHigh: 0 // J ≥ 1.8
    }

    // 遍历每个像素
    for (let i = 0; i < pixels.length; i += 4) {
      const dDx_dx = pixels[i]
      const dDz_dz = pixels[i + 1]
      const dDx_dz = pixels[i + 2]
      const dDz_dx = pixels[i + 3]

      // 计算 Jacobian
      const jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx

      jacobianValues.push(jacobian)
      minJ = Math.min(minJ, jacobian)
      maxJ = Math.max(maxJ, jacobian)
      sumJ += jacobian

      // 分布统计
      if (jacobian < 0) bins.negative++
      else if (jacobian < 0.3) bins.veryLow++
      else if (jacobian < 0.6) bins.low++
      else if (jacobian < 1.0) bins.medium++
      else if (jacobian < 1.3) bins.normal++
      else if (jacobian < 1.8) bins.high++
      else bins.veryHigh++
    }

    const totalPixels = width * height
    const avgJ = sumJ / totalPixels

    // 计算标准差
    let variance = 0
    for (const J of jacobianValues) {
      variance += Math.pow(J - avgJ, 2)
    }
    const stdDev = Math.sqrt(variance / totalPixels)

    // 输出统计结果
    console.log('📊 Jacobian 统计信息:')
    console.log('─────────────────────────────────────')
    console.log(`纹理尺寸: ${width} × ${height}`)
    console.log(`总像素数: ${totalPixels}`)
    console.log(`最小值: ${minJ.toFixed(4)}`)
    console.log(`最大值: ${maxJ.toFixed(4)}`)
    console.log(`平均值: ${avgJ.toFixed(4)}`)
    console.log(`标准差: ${stdDev.toFixed(4)}`)
    console.log('')

    console.log('📈 数值分布:')
    console.log('─────────────────────────────────────')
    const printBin = (label: string, count: number, color: string) => {
      const percent = ((count / totalPixels) * 100).toFixed(2)
      const bar = '█'.repeat(Math.floor((count / totalPixels) * 50))
      console.log(
        `${color}${label.padEnd(20)} ${count.toString().padStart(6)} (${percent}%) ${bar}`
      )
    }

    printBin('🔴 折叠 (J < 0)', bins.negative, '\x1b[31m')
    printBin('🟡 极尖锐 (0~0.3)', bins.veryLow, '\x1b[33m')
    printBin('🟢 尖锐 (0.3~0.6)', bins.low, '\x1b[32m')
    printBin('🔵 中等 (0.6~1.0)', bins.medium, '\x1b[36m')
    printBin('⚪ 正常 (1.0~1.3)', bins.normal, '\x1b[37m')
    printBin('🟣 拉伸 (1.3~1.8)', bins.high, '\x1b[35m')
    printBin('⚫ 过度拉伸 (≥1.8)', bins.veryHigh, '\x1b[90m')
    console.log('\x1b[0m') // 重置颜色

    // 警告信息
    if (bins.negative > totalPixels * 0.15) {
      console.warn('⚠️ 折叠区域过多 (>15%)，建议降低 choppiness')
    }
    if (bins.veryHigh > totalPixels * 0.1) {
      console.warn('⚠️ 过度拉伸区域较多 (>10%)，可能影响视觉效果')
    }
    if (bins.veryLow + bins.low < totalPixels * 0.1) {
      console.warn('💡 尖锐区域较少 (<10%)，建议增加 choppiness')
    }

    console.log('─────────────────────────────────────')
  }
}

// 使用方法（在你的更新循环或初始化后调用）
// const analyzer = new JacobianAnalyzer()
// analyzer.analyzeJacobianTexture(
//   this.gl,
//   this.jacobianTextureFBO.getFrameBuffer().textures[0],
//   this.N, // 纹理宽度
//   this.N // 纹理高度
// )
