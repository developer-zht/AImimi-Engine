#ifdef GL_ES
precision highp float;
#endif

void main() {
  // 什么都不写，GPU 自动把 gl_FragCoord.z 写入 depth texture
}
