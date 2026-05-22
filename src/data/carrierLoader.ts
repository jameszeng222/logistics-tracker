let _cache: Record<string, string> | null = null

export async function getCarrierData(): Promise<Record<string, string>> {
  if (_cache) return _cache
  try {
    const res = await fetch('/carriers.json')
    _cache = await res.json()
    return _cache!
  } catch {
    _cache = {}
    return _cache
  }
}

export function getCachedCarrierData(): Record<string, string> | null {
  return _cache
}
