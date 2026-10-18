/** Un resultado incierto conserva la clave hasta confirmar éxito o editar el contenido. */
export function createSendAttempt() {
  let current: { content: string; key: string } | null = null;
  return {
    key(content: string): string {
      if (current?.content !== content) current = { content, key: crypto.randomUUID() };
      return current.key;
    },
    clear() { current = null; },
  };
}

export const UNCERTAIN_SEND = "No se pudo confirmar el envío; revisa el hilo antes de intentarlo de nuevo";
