// Función serverless de Vercel: sigue la redirección de un enlace acortado
// de Google Maps y devuelve la URL final (que sí contiene las coordenadas).
// El navegador no puede hacerlo directamente porque esos dominios no envían
// cabeceras CORS. Allowlist estricta para no ser un proxy abierto.
const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

export default async function handler(req, res) {
  const raw = req.query.url;
  const input = Array.isArray(raw) ? raw[0] : raw;

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    res.status(400).json({ error: "URL inválida" });
    return;
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    res.status(400).json({ error: "Dominio no permitido" });
    return;
  }

  try {
    const upstream = await fetch(parsed.href, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; RutaFacil/0.1)" },
    });
    // La URL final es lo único que interesa; el cuerpo se descarta.
    res.setHeader("cache-control", "public, max-age=86400");
    res.status(200).json({ url: upstream.url });
  } catch {
    res.status(502).json({ error: "No se pudo resolver el enlace" });
  }
}
