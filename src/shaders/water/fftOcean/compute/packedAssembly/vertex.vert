/**
 * Packed IFFT Assembly — Vertex Shader (passthrough)
 *
 * 功能：
 *   全屏 quad 的 NDC passthrough。配合 packedAssembly/fragment.frag —
 *   把 4 张 packed IFFT 输出解包成 displacement / gradient / jacobian / foam（MRT）。
 *
 * I/O：
 *   aVertexPosition — NDC 顶点
 *   aTextureCoord   — [0,1]² 纹素 UV
 *   vTexCoord       — 透传到 fragment，对应一个空间格点 (x,z) 的 IFFT 结果
 *   gl_Position     — 直接写 NDC
 */

#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTextureCoord;
  gl_Position = vec4(aVertexPosition, 1.0);
}
