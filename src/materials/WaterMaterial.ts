import { Material } from '@/materials/Material'

import { UniformType, type Uniforms } from '@/types/Material'
import { Vec2, Vec3 } from '@/types/math'

export enum WaterTextureMapUniformType {
  U_DIFFUSE_MAP = 'useDiffuseMap',
  U_NORAML_MAP = 'useNormalMap',
  U_ENVIRONMENT_MAP = 'useEnvironmentMap'
}

export enum WaterColorUniformType {
  U_WATER_COLOR = 'uWaterColor',
  U_DEEP_WATER_COLOR = 'uDeepWaterColor',
  U_SHALLOW_WATER_COLOR = 'uShallowWaterColor'
}

export enum PhysicalParamUniformType {
  U_TRANSPARENCY = 'uTransparency',
  U_REFLECTANCE = 'uReflectance',
  U_REFRACTIVE_INDEX = 'uRefractiveIndex'
}

export enum RadianceParamUniformType {
  U_SPECULAR_POWER = 'uSpecularPower',
  U_FRESNEL_POWER = 'uFresnelPower'
}

// FIXME: 将该interface移至.d.ts文件中
// 水体材质的基础参数
export interface WaterMaterialParams {
  // 纹理使用标志
  useDiffuseMap: number
  useNormalMap: number
  useEnvironmentMap: number
  // 基础纹理
  diffuseMap: WebGLTexture | null
  normalMap: WebGLTexture | null
  environmentMap: WebGLTexture | null

  // 水体颜色参数
  waterColor: [number, number, number] // 主要水体颜色
  deepWaterColor: [number, number, number] // 深水区颜色（模拟深度效果）
  shallowWaterColor: [number, number, number] // 浅水区颜色（近岸效果）

  // 水体物理参数
  transparency: number // 透明度（0-1），控制水的清澈程度
  reflectance: number // 反射强度（0-1），控制镜面反射程度
  refractiveIndex: number // 折射率（通常1.33），用于菲涅尔计算

  // 水深模型参数
  depthModel: number // 深度模型类型：0=平坦, 1=坡度, 2=径向, 3=复合
  maxDepth: number // 最大深度（米）
  minDepth: number // 最小深度（海岸线，米）
  depthCenter: Vec2 // 深度中心点（世界坐标）
  depthFalloff: number // 深度衰减系数（影响深度变化的陡峭程度）

  // 波浪控制参数 (会被具体的波浪材质类重写)
  // amplitude、frequency、angularFrequency、speed 留给子类扩展
  time: number

  // 光照参数
  lightColor: Vec3
  lightPos: Vec3
  lightDir: Vec3
  specularPower: number
  fresnelPower: number // 菲涅尔强度，控制视角相关的反射变化
}

export abstract class WaterMaterial extends Material {
  protected waterParameters: WaterMaterialParams

  constructor(
    waterParams: WaterMaterialParams,
    vertexShaderContent: string,
    fragmentShaderContent: string,
    additionalUniforms: Uniforms = {},
    additionalAttribs: string[] = []
  ) {
    // 设置默认参数
    const defaultParameters: WaterMaterialParams = {
      // 纹理使用标志
      useDiffuseMap: 0,
      useNormalMap: 0,
      useEnvironmentMap: 0,
      // 基础纹理
      diffuseMap: null,
      normalMap: null,
      environmentMap: null,
      // 水体颜色参数
      waterColor: [0.1, 0.3, 0.5],
      deepWaterColor: [0.0, 0.1, 0.2],
      shallowWaterColor: [0.2, 0.6, 0.8],
      // 水体物理参数
      transparency: 0.8,
      reflectance: 0.3,
      refractiveIndex: 1.33,
      // 水深模型参数
      depthModel: 2,
      maxDepth: 50.0,
      minDepth: 1.0,
      depthCenter: [0, 0],
      depthFalloff: 1.5,
      // 波浪控制参数
      time: 0.0,
      // 光照参数
      lightColor: [2, 2, 2],
      lightPos: [2, 2, 2],
      lightDir: [-1, -1, 1],
      specularPower: 2.0,
      fresnelPower: 5.0
    }

    const waterParameters = {
      ...defaultParameters,
      // 作用：覆盖默认值
      ...waterParams
    }

    // 构建基础 uniforms
    const waterUniforms: Uniforms = {
      // 纹理使用标志
      uUseDiffuseMap: { type: UniformType.ONE_I, value: waterParameters.useDiffuseMap },
      uUseNormalMap: { type: UniformType.ONE_I, value: waterParameters.useNormalMap },
      uUseEnvironmentMap: { type: UniformType.ONE_I, value: waterParameters.useEnvironmentMap },
      // 基础纹理
      ...(waterParameters.useDiffuseMap
        ? {
            uDiffuseMap: { type: UniformType.TEXTURE_2D, value: waterParameters.diffuseMap }
          }
        : null),
      ...(waterParameters.useNormalMap
        ? {
            uNormalMap: { type: UniformType.TEXTURE_2D, value: waterParameters.normalMap }
          }
        : null),
      ...(waterParameters.useEnvironmentMap
        ? {
            uEnvironmentMap: {
              type: UniformType.TEXTURE_CUBE,
              value: waterParameters.environmentMap
            }
          }
        : null),

      // 水体颜色参数
      uWaterColor: { type: UniformType.THREE_FV, value: waterParameters.waterColor },
      uDeepWaterColor: { type: UniformType.THREE_FV, value: waterParameters.deepWaterColor },
      uShallowWaterColor: { type: UniformType.THREE_FV, value: waterParameters.shallowWaterColor },

      // 水体物理参数
      uTransparency: { type: UniformType.ONE_F, value: waterParameters.transparency },
      uReflectance: { type: UniformType.ONE_F, value: waterParameters.reflectance },
      uRefractiveIndex: { type: UniformType.ONE_F, value: waterParameters.refractiveIndex },

      // 水深模型参数
      uDepthModel: { type: UniformType.ONE_I, value: waterParameters.depthModel },
      uMaxDepth: { type: UniformType.ONE_F, value: waterParameters.maxDepth },
      uMinDepth: { type: UniformType.ONE_F, value: waterParameters.minDepth },
      uDepthCenter: { type: UniformType.TWO_FV, value: waterParameters.depthCenter },
      uDepthFalloff: { type: UniformType.ONE_F, value: waterParameters.depthFalloff },

      // 波浪控制参数
      uTime: { type: UniformType.ONE_F, value: waterParameters.time },

      // 光照参数
      uLightColor: { type: UniformType.THREE_FV, value: waterParameters.lightColor },
      uLightDir: { type: UniformType.THREE_FV, value: waterParameters.lightDir },
      uLightPos: { type: UniformType.THREE_FV, value: waterParameters.lightPos },
      uSpecularPower: { type: UniformType.ONE_F, value: defaultParameters.specularPower },
      uFresnelPower: { type: UniformType.ONE_F, value: defaultParameters.fresnelPower },

      // 合并额外的uniforms
      ...additionalUniforms
    }

    // console.log(waterUniforms)

    // 构建基础 attributes
    const waterAttributes = [...additionalAttribs]

    super(waterUniforms, waterAttributes, vertexShaderContent, fragmentShaderContent, null)

    // 将最终的 water 参数赋值给 waterParameters 属性
    this.waterParameters = waterParameters
  }

  // 设置 Texture Map(DiffuseMap/NormalMap/EnvironmentMap) Uniform
  setTextureMap(type: WaterTextureMapUniformType, textureMap: WebGLTexture) {
    switch (type) {
      case WaterTextureMapUniformType.U_DIFFUSE_MAP:
        if (this.waterParameters.useDiffuseMap) {
          this.waterParameters.diffuseMap = textureMap
          this.uniforms[type].value = textureMap
        }
        break
      case WaterTextureMapUniformType.U_NORAML_MAP:
        if (this.waterParameters.useNormalMap) {
          this.waterParameters.normalMap = textureMap
          this.uniforms[type].value = textureMap
        }
        break
      case WaterTextureMapUniformType.U_ENVIRONMENT_MAP:
        if (this.waterParameters.useEnvironmentMap) {
          this.waterParameters.environmentMap = textureMap
          this.uniforms[type].value = textureMap
        }
        break
    }
  }

  // 设置水体颜色
  setWaterColor(type: WaterColorUniformType, color: Vec3) {
    switch (type) {
      case WaterColorUniformType.U_WATER_COLOR:
        this.waterParameters.waterColor = color
        this.uniforms[type].value = color
        break
      case WaterColorUniformType.U_DEEP_WATER_COLOR:
        this.waterParameters.deepWaterColor = color
        this.uniforms[type].value = color
        break
      case WaterColorUniformType.U_SHALLOW_WATER_COLOR:
        this.waterParameters.shallowWaterColor = color
        this.uniforms[type].value = color
        break
    }
  }

  // 设置水体物理参数
  setPhysicalParam(type: PhysicalParamUniformType, value: number) {
    switch (type) {
      case PhysicalParamUniformType.U_TRANSPARENCY:
        this.waterParameters.transparency = value
        this.uniforms[type].value = value
        break
      case PhysicalParamUniformType.U_REFLECTANCE:
        this.waterParameters.reflectance = value
        this.uniforms[type].value = value
        break
      case PhysicalParamUniformType.U_REFRACTIVE_INDEX:
        this.waterParameters.refractiveIndex = value
        this.uniforms[type].value = value
        break
    }
  }

  // 设置光照参数
  setRadianceParam(type: RadianceParamUniformType, radiance: number) {
    switch (type) {
      case RadianceParamUniformType.U_SPECULAR_POWER:
        this.waterParameters.specularPower = radiance
        this.uniforms[type].value = radiance
        break
      case RadianceParamUniformType.U_FRESNEL_POWER:
        this.waterParameters.fresnelPower = radiance
        this.uniforms[type].value = radiance
        break
    }
  }

  // 获取当前参数
  // getParams(): WaterMaterialParams {
  //   return { ...this.params }
  // }
}
