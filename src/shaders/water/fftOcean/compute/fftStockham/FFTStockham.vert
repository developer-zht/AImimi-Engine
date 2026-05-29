/**
 * FFT Stockham — Vertex Shader (passthrough)
 *
 * 功能：
 *   全屏 quad 的 NDC passthrough，把 attribute UV 透传到 fragment。
 *   配合 FFTStockham1D.frag / FFTStockham2D.frag，在 FBO 上做 stage-by-stage Stockham FFT。
 *
 * I/O：
 *   aVertexPosition — NDC 空间下的顶点位置（来自 FullScreenQuad）
 *   aTextureCoord   — [0,1]² 的纹素 UV
 *   vTexCoord       — 透传给 fragment，作为本次 stage 要写入的输出像素 UV
 *   gl_Position     — 直接写 NDC，不做任何 MVP 变换
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
