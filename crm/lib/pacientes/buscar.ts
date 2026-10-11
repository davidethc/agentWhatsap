type Buscable = { nombre: string; telefono: string | null }

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/**
 * Filtra por nombre (sin mayúsculas ni tildes) o por teléfono (solo dígitos). Un teléfono escrito
 * como «099…» también coincide con el guardado como «593 99…».
 */
export function filtrarPacientes<T extends Buscable>(pacientes: T[], texto: string): T[] {
  const t = sinTildes(texto)
  if (!t) return pacientes
  const digitos = t.replace(/\D/g, "")
  const sinCero = digitos.replace(/^0/, "")
  return pacientes.filter(
    (p) =>
      sinTildes(p.nombre).includes(t) ||
      (digitos.length >= 3 && !!p.telefono && (p.telefono.includes(digitos) || p.telefono.includes(sinCero)))
  )
}
