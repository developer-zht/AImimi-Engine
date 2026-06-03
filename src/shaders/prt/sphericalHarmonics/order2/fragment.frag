#ifdef GL_ES
precision highp float;
#endif

varying vec3 vColor;

void main() {
  vec3 color = pow(vColor, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}
