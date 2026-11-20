/** Mulberry32 PRNG, bit-identical to java/.../util/Mulberry32.java. */
export class Mulberry32 {
  private state: number;

  constructor(seed = 42) {
    this.state = seed | 0;
  }

  nextDouble(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), this.state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(bound: number): number {
    if (bound <= 0) throw new Error('bound must be positive');
    return Math.min(Math.floor(this.nextDouble() * bound), bound - 1);
  }

  nextBoolean(): boolean {
    return this.nextDouble() < 0.5;
  }
}
