/**
 * Resuelve un enlace acortado (maps.app.goo.gl, etc.) a su URL final usando
 * la función serverless /api/resolve — el navegador no puede seguir esas
 * redirecciones por CORS. Devuelve null si no se pudo resolver (p. ej. en
 * desarrollo local, donde /api no existe).
 */
export async function resolveShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "url" in data &&
      typeof (data as { url: unknown }).url === "string"
    ) {
      return (data as { url: string }).url;
    }
    return null;
  } catch {
    return null;
  }
}
