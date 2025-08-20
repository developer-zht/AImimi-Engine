#ifdef GL_ES
precision highp float;
#endif

varying vec3 vTexCoord; // 代表3D纹理坐标的方向向量

uniform samplerCube uSkyboxMap;

void main() {
  gl_FragColor = textureCube(uSkyboxMap, vTexCoord);
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
