attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTextureCoord;
  gl_Position = vec4(aVertexPosition, 1.0);
}
