import { Toaster } from "@/components/ui/sonner"
import type { Metadata } from "next"
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from "next/font/google"
import "./globals.css"

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-serif",
})

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
})

export const metadata: Metadata = {
  title: "Eli Panel",
  description: "Panel de pacientes y citas de EliDental",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}