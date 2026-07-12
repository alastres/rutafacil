import { useRef, useState } from "react";

export function AddStop({
  onSubmit,
  onNotify,
}: {
  onSubmit: (text: string) => Promise<boolean>;
  onNotify: (text: string, error?: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  // textarea (no input): un input de una línea elimina los saltos de línea
  // al pegar, y romperia el pegado de conversaciones enteras
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    setBusy(true);
    try {
      if (await onSubmit(value)) setValue("");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Lee el portapapeles directamente (flujo de escritorio: copiar en
   * WhatsApp Web → un clic aquí). Acepta texto con varias ubicaciones.
   */
  const pasteFromClipboard = async () => {
    setBusy(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!(await onSubmit(text))) setValue(text);
    } catch {
      // Sin permiso o sin soporte (p. ej. Firefox): pegar manual
      onNotify("No pude leer el portapapeles. Pega con Ctrl+V en el campo.", true);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="add-stop">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Pega enlaces de Maps o coordenadas"
        aria-label="Pega enlaces de Maps o coordenadas"
        disabled={busy}
      />
      <button
        className="btn-paste"
        onClick={() => void pasteFromClipboard()}
        disabled={busy}
        title="Pegar del portapapeles"
      >
        Pegar
      </button>
      <button onClick={() => void submit()} disabled={busy}>
        Agregar
      </button>
    </div>
  );
}
