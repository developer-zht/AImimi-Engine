import { Transform } from '@/objects/utils/Transform'
import { Shader } from '@/shaders/Shader'

import { LineRenderer } from '@/renderers/LineRenderer'

import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { AxisMaterial } from '@/materials/axes/AxisMaterial'
import { AxesMesh } from '@/objects/AxesMesh'
import { LineRenderMode } from '@/renderers/types/LineRenderMode'

export interface AxisRendererConfig {
  /** 模型变换参数（通常是单位变换：位移=0，缩放=1，旋转=0） */
  transform: Transform
}

export async function createAxesRenderer(
  gl: WebGLRenderingContext,
  config: AxisRendererConfig
): Promise<LineRenderer> {
  // Step 1: 内联顶点数据（6 个顶点 = 3 条线段 × 2 端点）
  // const positions: AttributeData = {
  //   name: 'aVertexPosition',
  //   array: new Float32Array([
  //     0.0,
  //     0.0,
  //     0.0,
  //     1.0,
  //     0.0,
  //     0.0, // X 轴
  //     0.0,
  //     0.0,
  //     0.0,
  //     0.0,
  //     1.0,
  //     0.0, // Y 轴
  //     0.0,
  //     0.0,
  //     0.0,
  //     0.0,
  //     0.0,
  //     1.0 // Z 轴
  //   ]),
  //   size: 3,
  //   type: gl.FLOAT
  // }

  // const colors: AttributeData = {
  //   name: 'aColor',
  //   array: new Float32Array([
  //     1.0,
  //     0.0,
  //     0.0,
  //     1.0,
  //     0.0,
  //     0.0, // 红
  //     0.0,
  //     1.0,
  //     0.0,
  //     0.0,
  //     1.0,
  //     0.0, // 绿
  //     0.0,
  //     0.0,
  //     1.0,
  //     0.0,
  //     0.0,
  //     1.0 // 蓝
  //   ]),
  //   size: 3,
  //   type: gl.FLOAT
  // }

  // const indices = [0, 1, 2, 3, 4, 5]

  // Step 2: 变换 + Mesh（用基础 Mesh，无需 AxisMesh 子类）
  // const mesh = new Mesh([positions, colors], indices, config.transform, 'AxisMesh', gl)

  const ctx = '[createAxesRenderer]'
  const rendererName = 'AxesLineRenderer'

  // 1. 创建 axes mesh
  const mesh = new AxesMesh(gl, config.transform, `${ctx} AxesMesh<${rendererName}>`)

  // 2. 材质（空 uniform —— Axis 只用 per-vertex color）
  const material = new AxisMaterial({}, `AxisMaterial<${rendererName}>`)

  // 3. 创建 Shader
  const shader = await Shader.createShader(gl, ShaderPaths.AXIS_VERTEX, ShaderPaths.AXIS_FRAGMENT)

  // 4. LineRender (gl.LINES)
  const lineRenderer = new LineRenderer(
    gl,
    mesh,
    material,
    shader,
    LineRenderMode.LINES,
    `${ctx} ${rendererName}`
  )

  return lineRenderer
}
