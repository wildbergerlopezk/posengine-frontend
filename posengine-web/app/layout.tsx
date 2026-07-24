import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthInterceptor } from "@/src/shared/components/AuthInterceptor";
import "@/styles/globals.css";

const _inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POSENGINE - Sistema de Punto de Venta",
  description: "Sistema POS en la nube para gestionar tu negocio de forma eficiente",
  generator: "v0.app",
  icons: {
    icon: "/ico.png",
    apple: "/ico.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${_inter.className} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthInterceptor />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}