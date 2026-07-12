import { useState } from "react";

export function AddStop({ onSubmit }: { onSubmit: (text: string) => boolean }) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    if (onSubmit(value)) setValue("");
  };

  return (
    <div className="add-stop">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Pega un enlace de Maps o coordenadas"
        aria-label="Pega un enlace de Maps o coordenadas"
      />
      <button onClick={submit}>Agregar</button>
    </div>
  );
}
