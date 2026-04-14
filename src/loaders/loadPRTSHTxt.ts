import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'
import { TransportType } from './types/loadPRT'
import { fetchTextWithTimeout } from '@/network/fetchText'

export interface PRTData {
  lightSH: number[][] // 光照 SH 系数 [3 channels][n coefficients]
  transportSH: number[][] // 每个顶点的传输 SH 系数 [vertexCount][n coefficients]
  vertexCount: number
}

export async function loadPRTSHTxt(
  envDir: string,
  modelName: string,
  transportType: TransportType
): Promise<PRTData> {
  const lightPath = `${envDir}/light.txt`
  const modelPath = `${envDir}/transport_${modelName}_${transportType}.txt`

  const DEBUG_FUNCTION_NAME = 'loadPRTSHTxt'

  console.debug(`[${DEBUG_FUNCTION_NAME}] `, lightPath)
  console.debug(`[${DEBUG_FUNCTION_NAME}] `, modelPath)

  const [lightText, transportText] = await Promise.all([
    fetchTextWithTimeout(lightPath),
    fetchTextWithTimeout(modelPath)
  ])

  console.debug(`[${DEBUG_FUNCTION_NAME}] \n`, lightText)

  // light.txt：每行 3 个数（RGB 三通道），一共 9 行（9 个 SH 系数）
  // 解析成：3 行（RGB 三通道），每行 9 个 SH 系数，也就是 lightSH[3][9]
  const rawArr = lightText
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number))

  // 校验：格式合法性
  if (rawArr.length === 0 || !rawArr[0]?.length) {
    throw new ResourceLoadError('prt-light', lightPath, {
      reason: 'Light SH file is empty or malformed'
    })
  }
  // 校验：每行列数一致（不确定是否保留）
  // const numChannels = rawArr[0].length
  // for (let i = 1; i < rawArr.length; i++) {
  //   if (rawArr[i]!.length !== numChannels) {
  //     throw new ResourceLoadError('prt-light', lightPath, {
  //       reason: `Line ${i} has ${rawArr[i]!.length} values, expected ${numChannels}`
  //     })
  //   }
  // }

  // 解析
  let lightSH: number[][] = Array.from({ length: 3 }, () => {
    return Array.from({ length: 9 }, () => 0)
  })
  if (rawArr[0]) {
    lightSH = rawArr[0].map((_, colIndex) => {
      return rawArr.map((row) => row[colIndex]) as number[]
    })
  }

  console.debug(`[${DEBUG_FUNCTION_NAME}] lightSH: `, lightSH)

  // transport.txt：第一行为 vertex count，第二行开始，每行 9 个数（9 个 SH 系数），一共 vertex count 行
  // 解析成：vertexCount + 每个顶点的系数为一个数组（由 9 个 SH 系数组成），总共 vertex count 个这样的数组，也就是 transportSH[vertexCount][9]
  const transportLines = transportText.trim().split('\n')
  const vertexCount = parseInt(transportLines[0] ?? '0') // 第一行是顶点数
  // 校验：如果 vertexCount === 0，说明数据有问题，直接报错
  if (vertexCount === 0) {
    throw new ResourceLoadError('prt-transport', modelPath, {
      reason: 'Transport file has 0 vertices'
    })
  }
  // 解析
  const transportSH: number[][] = transportLines
    .slice(1) // 跳过第一行
    .map((line) => line.trim().split(/\s+/).map(Number))

  if (transportSH.length !== vertexCount) {
    console.warn(
      `[${DEBUG_FUNCTION_NAME}] Header says ${vertexCount} vertices, ` +
        `but file has ${transportSH.length} data lines`
    )
  }

  // console.debug('[loadPRT] transportSH:', transportSH)

  // console.debug(
  //   `[loadPRT] ${envDir}: lightSH=${lightSH.length} coeffs, ` +
  //     `transportSH=${transportSH.length} face-vertices, ` +
  //     `vertexCount=${vertexCount}`
  // )

  return { lightSH, transportSH, vertexCount }
}
