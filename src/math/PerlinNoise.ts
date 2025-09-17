class PerlinNoise {
  private perm: number[] = []

  constructor() {
    // 初始化排列表
    for (let i = 0; i < 256; i++) {
      this.perm[i] = Math.floor(Math.random() * 256)
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a)
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255

    x -= Math.floor(x)
    y -= Math.floor(y)

    const u = this.fade(x)
    const v = this.fade(y)

    const A = this.perm[X] + Y
    const AA = this.perm[A & 255]
    const AB = this.perm[(A + 1) & 255]
    const B = this.perm[(X + 1) & 255] + Y
    const BA = this.perm[B & 255]
    const BB = this.perm[(B + 1) & 255]

    return this.lerp(
      v,
      this.lerp(u, this.grad(this.perm[AA & 255], x, y), this.grad(this.perm[BA & 255], x - 1, y)),
      this.lerp(
        u,
        this.grad(this.perm[AB & 255], x, y - 1),
        this.grad(this.perm[BB & 255], x - 1, y - 1)
      )
    )
  }
}
