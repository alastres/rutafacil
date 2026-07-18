import { useRef, useState } from "react";

export function AddStop({
  onSubmit,
}: {
  onSubmit: (text: string) => Promise<boolean>;
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
      <button onClick={() => void submit()} disabled={busy}>
        Agregar
      </button>
    </div>
  );
}
