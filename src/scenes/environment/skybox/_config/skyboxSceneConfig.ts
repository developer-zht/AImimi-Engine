import { TexturePaths } from '@/textures/_config/texturePaths'
import { SkyboxConfig } from '../types/SkyboxConfig'

// ==================== CITRUS_ORCHARD PURESKY HDR ====================
export const SKYBOX_CITRUS_ORCHARD_PURESKY_2K_HDR: SkyboxConfig = {
  basePath: TexturePaths.CITRUS_ORCHARD_PURESKY_2K_HDR,
  extension: '.hdr',
  flipY: true,
  rotationY: 45,
  exposure: 0.5
}

export const SKYBOX_CITRUS_ORCHARD_ROAD_PURESKY_2K_HDR: SkyboxConfig = {
  basePath: TexturePaths.CITRUS_ORCHARD_ROAD_PURESKY_2K_HDR,
  extension: '.hdr',
  flipY: true,
  rotationY: 60,
  exposure: 0.5
}

export const SKYBOX_CITRUS_INDUSTRIAL_SUNSET_PURESKY_2K_HDR: SkyboxConfig = {
  basePath: TexturePaths.CITRUS_ORCHARD_INDUSTRIAL_SUNSET_PURESKY_2K_HDR,
  extension: '.hdr',
  flipY: true,
  rotationY: 60,
  exposure: 0.3
}

// =============== KLOOFENDAL PURESKY HDR ===============
export const SKYBOX_KLOOFENDAL_06_PURESKY_2K_EXR: SkyboxConfig = {
  basePath: TexturePaths.KLOOFENDAL_06_PURESKY_2K_EXR,
  extension: '.exr',
  rotationY: 80
}

export const SKYBOX_KLOOFENDAL_43D_CLEAR_PURESKY_2K_EXR: SkyboxConfig = {
  basePath: TexturePaths.KLOOFENDAL_43D_CLEAR_PURESKY_2K_EXR,
  extension: '.exr',
  rotationY: 80
}

// =============== QWANTANI PURESKY HDR ===============
export const SKYBOX_QWANTANI_AFTERNOON_PURESKY_2K_HDR: SkyboxConfig = {
  basePath: TexturePaths.QWANTANI_AFTERNOON_PURESKY_2K_HDR,
  extension: '.hdr',
  flipY: true
}

// =============== SKY_SUNSET CUBEMAP ===============

export const SKYBOX_SKY_SUNSET_CUBEMAP: SkyboxConfig = {
  basePath: TexturePaths.SKY_SUNSET,
  extension: '.png'
}

// =============== SKY_09 CUBEMAP ===============

export const SKYBOX_SKY_09_CUBEMAP: SkyboxConfig = {
  basePath: TexturePaths.SKY_09_CUBEMAP,
  extension: '.png'
}

// =============== SKY_18 CUBEMAP ===============

export const SKYBOX_SKY_18_CUBEMAP: SkyboxConfig = {
  basePath: TexturePaths.SKY_18_CUBEMAP,
  extension: '.png'
}
