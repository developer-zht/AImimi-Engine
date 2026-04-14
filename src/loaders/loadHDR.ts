import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { DataTexture } from 'three'
import * as THREE from 'three'
import { EngineRunningError } from '@/errors/EngineError/EngineRunningError'
import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'
import { HDRConfig } from './types/loadHDR'

// Deprecated
// export type HDRFileType = 'HDR' | 'EXR'

/**
 * 加载 HDR/EXR 文件，返回 Three.js DataTexture（纯数据，不碰 GPU）
 */
export async function loadHDR(config: HDRConfig): Promise<DataTexture> {
  const { basePath, extension } = config
  console.log(`[loadHDR] Loading ${extension}: ${basePath}`)

  try {
    switch (extension) {
      case '.hdr':
        return await loadRGBE(basePath)
      case '.exr':
        return await loadEXR(basePath)

      default: {
        throw new EngineRunningError(
          `Unsupported HDR format: ${extension}`,
          'UNSUPPORTED_HDR_FORMAT',
          { context: { extension, basePath }, recoverable: false }
        )
      }
    }
  } catch (error) {
    if (error instanceof EngineRunningError) throw error
    throw new ResourceLoadError(
      extension.toLowerCase(),
      basePath,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}

async function loadEXR(path: string): Promise<DataTexture> {
  const loader = new EXRLoader()
  loader.setDataType(THREE.FloatType)
  const dataTexture = await loader.loadAsync(path)
  return dataTexture
}

async function loadRGBE(path: string): Promise<DataTexture> {
  const loader = new RGBELoader()
  loader.setDataType(THREE.FloatType)
  const dataTexture = await loader.loadAsync(path)
  return dataTexture
}
