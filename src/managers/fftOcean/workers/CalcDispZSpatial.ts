import { SerializedSpectrum } from '@/types/worker'
import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { Complex } from '@/math/Complex'
import {
  deserializeArraysToSpectrum,
  serializeSpatialToArrays
} from '@/managers/fftOcean/utils/spectrumSerializer'

const fftProcessor = new FFTProcessor()

addEventListener('message', (event: MessageEvent<SerializedSpectrum>) => {
  const serializedSpectrum = event.data
  const { realArray, imagArray, dimension } = serializedSpectrum

  // 反序列化为 Complex 对象
  const dispZSpectrum: Complex[][] = deserializeArraysToSpectrum(realArray, imagArray, dimension)

  const dispZSpatial = fftProcessor.ifft2DInterface(dispZSpectrum)

  const serializedDispZSpatial = serializeSpatialToArrays(dispZSpatial)

  postMessage(serializedDispZSpatial)
})
