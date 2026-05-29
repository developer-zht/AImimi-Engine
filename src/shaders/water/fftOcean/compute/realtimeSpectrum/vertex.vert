/**
 * Realtime Spectrum — Vertex Shader (passthrough)
 *
 * 功能：
 *   全屏 quad 的 NDC passthrough。配合 realtimeSpectrum/fragment.frag —
 *   在 GPU 上完成 h(k, t) = h0·e^{iωt} + conj(h0(-k))·e^{-iωt} 的时域演化，
 *   并把 height / disp / slope / Jacobian 共 4 个谱压成 4 张 packed 复数纹理（MRT）。
 *
 * I/O：
 *   aVertexPosition — NDC 顶点（来自 FullScreenQuad）
 *   aTextureCoord   — [0,1]² 纹素 UV，对应频域 (kx, kz) 网格
 *   vTexCoord       — 透传到 fragment，作为频域采样坐标
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
