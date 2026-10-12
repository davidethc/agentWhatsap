/**
 * Espejo de `private.normalizar_telefono` de la base: la base manda, esto solo permite
 * validar y mostrar sin ir al servidor. Ecuador: 593 + 8 o 9 dígitos, sin «+».
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  let v = (entrada ?? "").replace(/[^0-9]/g, "")
  if (v === "") return null
  if (v.startsWith("00")) v = v.slice(2)
  if (/^0[0-9]{8,9}$/.test(v)) v = "593" + v.slice(1)
  else if (/^9[0-9]{8}$/.test(v)) v = "593" + v
  if (!/^593[0-9]{8,9}$/.test(v)) throw new Error("Teléfono no válido")
  return v
}

/** «593991234567» → «+593 99 123 4567» (solo para mostrar). */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return "Sin teléfono"
  const m = /^593(\d{2})(\d{3})(\d{3,4})$/.exec(telefono)
  return m ? `+593 ${m[1]} ${m[2]} ${m[3]}` : telefono
}
