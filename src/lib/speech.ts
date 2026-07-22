/**
 * Módulo de Síntesis de Voz (Web Speech API) para navegación asistida in-app.
 * Totalmente gratuito, offline y compatible con iOS (Siri TTS) y Android.
 */

let muted = false;
let lastSpokenText = "";
let lastSpokenTime = 0;

const DUP_COOLDOWN_MS = 6000;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(val: boolean): void {
  muted = val;
  if (muted && isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/**
 * Emite una instrucción de voz en español si el audio no está silenciado.
 * Compatible con el motor Siri de iOS y síntesis nativa de Android/Chrome.
 */
export function speak(text: string, force = false): void {
  if (muted || !isSpeechSupported()) return;

  const now = Date.now();
  if (!force && text === lastSpokenText && now - lastSpokenTime < DUP_COOLDOWN_MS) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Detener frase anterior si estaba hablando
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-CO";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const esVoice = voices.find(
        (v) =>
          v.lang.startsWith("es-CO") ||
          v.lang.startsWith("es-MX") ||
          v.lang.startsWith("es-ES") ||
          v.lang.startsWith("es")
      );
      if (esVoice) utterance.voice = esVoice;
    }

    lastSpokenText = text;
    lastSpokenTime = now;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("SpeechSynthesis error:", err);
  }
}

/** Cancela cualquier indicación de voz en curso. */
export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Cargar voces en segundo plano para iOS Safari
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
