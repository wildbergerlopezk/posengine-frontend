import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { useAppUpdater } from '@/hooks/useAppUpdater';
import styles from './update-dialog.module.css';

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
          {children}
          <Analytics />
          <UpdateDialog />
        </ThemeProvider>
      </body>
    </html>
  );
}

function UpdateDialog() {
  const { updateAvailable, updateInfo, downloading, progress, installUpdate } = useAppUpdater();

  if (!updateAvailable) return null;

  return (
    <div className={styles.updateBanner}>
      <p>Nueva versión disponible: <strong>v{updateInfo?.version}</strong></p>
      {downloading ? (
        <div className={styles.progressBar}>
          <div style={{ width: `${progress}%` }} />
          <span>Descargando... {progress}%</span>
        </div>
      ) : (
        <button onClick={installUpdate}>Descargar e instalar</button>
      )}
    </div>
  );
}