export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now()
  const result = await fn()
  const duration = performance.now() - t0
  console.log(`[perf] ${label}: ${duration.toFixed(2)}ms`)
  return result
}
