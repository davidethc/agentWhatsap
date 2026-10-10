import { z } from "zod"

export const esquemaLogin = z.object({
  correo: z.string().trim().min(1, "Escribe tu correo.").email("Ese correo no parece válido."),
  clave: z.string().min(1, "Escribe tu clave."),
})
