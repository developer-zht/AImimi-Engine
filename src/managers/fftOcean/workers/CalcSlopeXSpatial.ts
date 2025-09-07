import { FFTWorkerMessage } from '@/types/worker'
import { FFTProcessor } from '@/math/FFTProcessor'
import { Complex } from '@/math/Complex'

const fftProcessor = new FFTProcessor()

addEventListener('message', (event: MessageEvent<FFTWorkerMessage>) => {
  const { serializedSlopeXSpectrum } = event.data

  // 反序列化为 Complex 对象
  const slopeXSpectrum: Complex[][] = serializedSlopeXSpectrum.map((row) =>
    row.map((item) => new Complex(item.real, item.imag))
  )

  const slopeXSpatial = fftProcessor.ifft2DInterface(slopeXSpectrum)

  const serializedSlopeXSpatial = slopeXSpatial.map((row) =>
    row.map((complex) => ({
      real: complex.real,
      imag: complex.imag
    }))
  )

  postMessage(serializedSlopeXSpatial)
})
