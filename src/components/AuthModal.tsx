import { useState } from "react";
import { toast } from "react-hot-toast";
import { useRouteStore } from "../state/routeStore";
import { CloseIcon, CheckIcon } from "./icons";

export function AuthModal() {
  const isOpen = useRouteStore((s) => s.isAuthModalOpen);
  const setOpen = useRouteStore((s) => s.setAuthModalOpen);
  const loginUser = useRouteStore((s) => s.loginUser);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success: boolean; code?: string; error?: string };
      if (res.ok && data.success) {
        toast.success("Código de verificación generado.");
        if (data.code) {
          toast(`Código Dev: ${data.code}`, { icon: "🔧", duration: 8000 });
        }
        setStep(2);
      } else {
        toast.error(data.error || "No se pudo enviar el código.");
      }
    } catch {
      // Fallback para desarrollo local con vite dev server (sin vercel CLI)
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        toast.success("Código generado localmente (Fallback de Desarrollo)");
        toast("Código Dev: 123456", { icon: "🔧", duration: 8000 });
        setStep(2);
      } else {
        toast.error("Error de conexión.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = (await res.json()) as { success: boolean; token?: string; tier?: 'free' | 'pro'; error?: string };
      if (res.ok && data.success && data.token && data.tier) {
        loginUser(email, data.token, data.tier);
        toast("Sesión iniciada con éxito", {
          icon: <CheckIcon width={18} height={18} />,
        });
        setOpen(false);
        // Reset state
        setEmail("");
        setOtp("");
        setStep(1);
      } else {
        toast.error(data.error || "Código incorrecto.");
      }
    } catch {
      // Fallback para desarrollo local con vite dev server
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        if (otp === "123456") {
          const simulatedTier = email.toLowerCase() === "pro@rutafacil.com" ? "pro" : "free";
          // Token JWT simulado codificado en base64 para poder decodificarlo en App.tsx y routing.ts
          const payload = { email, tier: simulatedTier };
          const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;
          loginUser(email, mockToken, simulatedTier);
          toast("Sesión iniciada con éxito (Simulado)", {
            icon: <CheckIcon width={18} height={18} />,
          });
          setOpen(false);
          setEmail("");
          setOtp("");
          setStep(1);
        } else {
          toast.error("Código incorrecto (usa 123456).");
        }
      } else {
        toast.error("Error al validar el código.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesión"
      onClick={(e) => e.target === e.currentTarget && !loading && setOpen(false)}
      style={{ zIndex: 110 }}
    >
      <div className="history-panel subscription-modal-panel">
        <div className="history-panel__header">
          <h2>Restaurar Cuenta PRO</h2>
          <button className="history-close" onClick={() => setOpen(false)} disabled={loading}>
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="subscription-modal-body">
          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="return-point-form" style={{ padding: 0 }}>
              <div className="return-point-form__field" style={{ marginBottom: "12px" }}>
                <label htmlFor="auth-email">Correo de tu suscripción</label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className="return-point-new" style={{ margin: "8px 0", width: "100%" }} disabled={loading}>
                {loading ? "Generando..." : "Enviar Código"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="return-point-form" style={{ padding: 0 }}>
              <div className="return-point-form__field" style={{ marginBottom: "12px" }}>
                <label htmlFor="auth-otp">Ingresa el código de 6 dígitos</label>
                <input
                  id="auth-otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="return-point-form__actions" style={{ gap: "8px" }}>
                <button type="submit" className="return-point-new" style={{ margin: "8px 0 0", flex: 1 }} disabled={loading}>
                  {loading ? "Verificando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  className="return-point-remove"
                  style={{ margin: "8px 0 0", flex: 1 }}
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Volver
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
