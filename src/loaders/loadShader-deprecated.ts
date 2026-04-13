import { FileLoader } from 'three'

export function loadShaderFile(filename: string) {
  return new Promise<string | ArrayBuffer>((resolve, reject) => {
    const loader = new FileLoader()

    loader.load(
      filename,
      (data) => {
        // Debug Code
        // console.log('data', data)
        resolve(data)
      },
      undefined,
      (err) => reject(err)
    )
  })
}

export async function getShaderString(filename: string): Promise<string> {
  try {
    // Debug Code
    // console.log(filename)
    const val = (await loadShaderFile(filename)) as string
    return val
  } catch (error) {
    console.log('getShaderString function has an error: ', error)
    throw error
  }
}
