export function safeRedirect(value: string | null, origin: string): string {
  if (!value?.startsWith('/')) return '/';
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch { return '/'; }
}
