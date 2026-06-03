import { BaseRenderer } from '@/renderers/BaseRenderer'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { FrameContext } from '@/renderers/types/FrameContext'
import { GBufferFBO } from '@/framebuffers/GBufferFBO'

/**
 * GBuffer 渲染 Pass
 *
 * 将场景几何信息渲染到 5-attachment G-Buffer：
 * Diffuse, Depth, Normal, Shadow, WorldPosition
 *
 * 目标 renderer 必须使用 GBufferMaterial
 */
export class GBufferRenderPass implements RenderPass {
  public readonly name: string = 'GBufferRenderPass'

  private gl: WebGLRenderingContext

  private gBufferFBO: GBufferFBO
  private targetRenderers: BaseRenderer[] = []

  constructor(gl: WebGLRenderingContext, width: number, height: number) {
    this.gl = gl

    this.gBufferFBO = new GBufferFBO(gl, width, height)
  }

  execute(context: FrameContext, camera: PerspectiveCamera): void {
    const gl = this.gl

    this.gBufferFBO.bind()
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // shader 只 use 一次，不是每个 renderer 内部各 use 一次
    // const shader = this.targetRenderers[0]?.shader
    // shader?.use()

    const fbo = this.gBufferFBO.getFBO()
    for (const targetRenderer of this.targetRenderers) {
      // draw() 内部又会 shader.use()，但因为 program 没变，是幂等操作
      // 真正的开销在 mesh.bind()（切换 VBO）和 material.applyUniforms()（切换纹理）
      targetRenderer.draw(context, fbo, camera)
    }

    this.gBufferFBO.unbind(gl.canvas.width, gl.canvas.height)
  }

  addTarget(renderer: BaseRenderer): void {
    this.targetRenderers.push(renderer)
  }

  /** 获取 GBufferFBO（供后续 pass 读取纹理） */
  getGBufferFBO(): GBufferFBO {
    return this.gBufferFBO
  }

  resize(width: number, height: number): void {
    this.gBufferFBO.resize(width, height)
  }

  dispose(): void {
    this.gBufferFBO.dispose()
    this.targetRenderers.length = 0
  }
}
