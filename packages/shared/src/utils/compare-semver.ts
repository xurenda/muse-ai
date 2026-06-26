/** 比较 SemVer：a > b 返回正数，相等返回 0 */
export function compareSemver(a: string, b: string): number {
  const parse = (value: string): [number, number, number] => {
    const parts = value.split('.')
    return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)]
  }
  const [aMajor, aMinor, aPatch] = parse(a)
  const [bMajor, bMinor, bPatch] = parse(b)
  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

/** 从版本列表中取最新 SemVer */
export function pickLatestSemver(versions: string[]): string | undefined {
  if (versions.length === 0) return undefined
  return versions.reduce((latest, current) => (compareSemver(current, latest) > 0 ? current : latest))
}
