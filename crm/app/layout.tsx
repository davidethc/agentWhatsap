import { Toaster } from "@/components/ui/sonner"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Eli Panel",
  description: "Panel de pacientes y citas de EliDental",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
