import { toast } from "react-hot-toast";

export async function startCheckout(provider: "stripe" | "mercadopago"): Promise<void> {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isDev) {
    const returnUrl = window.location.origin;
    window.location.href = `/mock-checkout.html?provider=${provider}&return_url=${encodeURIComponent(returnUrl)}`;
    return;
  }

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
      }),
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "url" in data &&
        typeof (data as { url: unknown }).url === "string"
      ) {
        window.location.href = (data as { url: string }).url;
      } else {
        throw new Error("No se devolvió URL de redirección.");
      }
    } else {
      throw new Error("Respuesta inválida del servidor de pagos.");
    }
  } catch (error) {
    console.error("Error al iniciar checkout:", error);
    toast.error("No se pudo contactar con el servicio de pagos. Inténtalo más tarde.");
  }
}
