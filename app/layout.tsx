import type { Metadata } from "next";
// 1. Usamos una fuente de Google (más estable y fácil)
import { Inter } from "next/font/google"; 
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// 2. Configuramos la fuente
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestion de vacaciones",
  description: "Sistema de Gestión de Vacaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/* AGREGA ESTO AQUÍ ABAJO: suppressHydrationWarning */}
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning={true} 
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}