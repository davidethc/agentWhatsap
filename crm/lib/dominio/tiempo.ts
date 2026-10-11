/** «hace 5 min», «hace 2 h», «hace 3 días». Recibe «ahora» para ser puro (y no romper el prerender). */
export function tiempoTranscurrido(desde: string, ahora: string): string {
  const min = Math.floor((new Date(ahora).getTime() - new Date(desde).getTime()) / 60_000)
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? "día" : "días"}`
}
