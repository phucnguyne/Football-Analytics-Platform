export function loginLink(path: string) {
  return `/login?callbackUrl=${encodeURIComponent(path)}`
}
