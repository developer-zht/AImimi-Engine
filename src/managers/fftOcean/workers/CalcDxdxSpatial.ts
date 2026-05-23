import { SerializedSpectrum } from '@/managers/fftOcean/workers/types/worker'
import { FFTProcessor } from '@/math/FFTProcessor-deprecated/FFTProcessor'
import { Complex } from '@/math/Complex'
import {
  deserializeArraysToSpectrum,
  serializeSpatialToArrays
} from '@/managers/fftOcean/deprecated/utils/spectrumSerializer'

const fftProcessor = new FFTProcessor()

addEventListener('message', (event: MessageEvent<SerializedSpectrum>) => {
  const serializedSpectrum = event.data
  const { realArray, imagArray, dimension } = serializedSpectrum

  // 反序列化为 Complex 对象
  const dispXSpectrum: Complex[][] = deserializeArraysToSpectrum(realArray, imagArray, dimension)

  const dispXSpatial = fftProcessor.ifft2DInterface(dispXSpectrum)

  const serializedDispXSpatial = serializeSpatialToArrays(dispXSpatial)

  postMessage(serializedDispXSpatial)
})
