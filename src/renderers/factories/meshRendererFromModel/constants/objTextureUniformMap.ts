/**
 * MeshPhongMaterial 贴图字段名 → shader uniform 名。
 * key 和 Three.js MeshPhongMaterial 的属性名完全一致。
 */
export const OBJ_TEXTURE_UNIFORM_MAP: Record<string, string> = {
  // SharedTextureData 的字段
  alphaImage: 'uAlphaMap',
  aoImage: 'uAOMap',
  diffuseImage: 'uDiffuseMap',
  displacementImage: 'uDisplacementMap',
  emissiveImage: 'uEmissiveMap',
  normalImage: 'uNormalMap',
  // OBJMeshData 特有
  specularImage: 'uSpecularMap'
}
