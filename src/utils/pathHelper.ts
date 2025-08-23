export function pathJoin(path: string, basePath: string): string {
  const p = path.trim()
  const b = basePath.trim()
  if (path.startsWith('/') && basePath.endsWith('/')) {
    return b + p.slice(1)
  }

  if (!path.startsWith('/') && !basePath.endsWith('/')) {
    return b + '/' + p
  }
}
