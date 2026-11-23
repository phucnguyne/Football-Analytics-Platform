export function isSupabasePublicKey(key: string) {
  if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return true

  const parts = key.split('.')
  if (parts.length !== 3 || parts.some((part) => !/^[\w-]+$/.test(part))) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'anon'
  } catch {
    return false
  }
}
