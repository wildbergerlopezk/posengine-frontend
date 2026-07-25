"use client"

import type { ReactNode } from "react"
import { Header } from "@/src/shared/components/Header"
import { Skeleton } from "@/src/shared/components/Skeleton"
import styles from "./SkeletonDemoPage.module.css"

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className={styles.sectionTitle}>{children}</h2>
)

const DemoCard = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={styles.demoCard}>
    <div className={styles.demoCardLabel}>{label}</div>
    {children}
  </div>
)

export function SkeletonDemoPage() {
  return (
    <div className={styles.page}>
      <Header title="Skeleton Loader Demo" />

      <div className={styles.container}>
        <SectionTitle>1 — Variantes básicas</SectionTitle>
        <div className={styles.gridBasics}>
          <DemoCard label="Líneas de texto">
            <div className={styles.textStack}>
              <Skeleton width="100%" height="14px" />
              <Skeleton width="100%" height="14px" />
              <Skeleton width="70%" height="14px" />
            </div>
          </DemoCard>

          <DemoCard label="Títulos + párrafo">
            <div className={styles.textStack}>
              <Skeleton width="55%" height="24px" />
              <Skeleton width="100%" height="12px" />
              <Skeleton width="100%" height="12px" />
              <Skeleton width="85%" height="12px" />
            </div>
          </DemoCard>

          <DemoCard label="Círculo (avatar)">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <Skeleton width="56px" height="56px" style={{ borderRadius: "9999px" }} />
              <div style={{ flex: 1 }} className={styles.textStack}>
                <Skeleton width="60%" height="16px" />
                <Skeleton width="40%" height="12px" />
              </div>
            </div>
          </DemoCard>

          <DemoCard label="Rectángulo (imagen/miniatura)">
            <Skeleton width="100%" height="140px" style={{ borderRadius: "0.5rem" }} />
          </DemoCard>

          <DemoCard label="Botones y chips">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
              <Skeleton width="100px" height="36px" style={{ borderRadius: "0.5rem" }} />
              <Skeleton width="72px" height="36px" style={{ borderRadius: "9999px" }} />
              <Skeleton width="88px" height="28px" style={{ borderRadius: "9999px" }} />
              <Skeleton width="56px" height="28px" style={{ borderRadius: "9999px" }} />
            </div>
          </DemoCard>

          <DemoCard label="Barra de progreso / inputs">
            <div className={styles.textStack}>
              <Skeleton width="30%" height="12px" />
              <Skeleton width="100%" height="40px" style={{ borderRadius: "0.5rem" }} />
              <Skeleton width="80%" height="8px" />
            </div>
          </DemoCard>
        </div>

        <SectionTitle>2 — Tarjetas con icono (estilo Dashboard stat)</SectionTitle>
        <div className={styles.statGrid}>
          {[
            { w1: "70px", w2: "90px", w3: "120px" },
            { w1: "85px", w2: "110px", w3: "130px" },
            { w1: "95px", w2: "95px", w3: "110px" },
            { w1: "65px", w2: "80px", w3: "140px" },
          ].map((s, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statHeader}>
                <Skeleton width={s.w1} height="14px" />
                <Skeleton width="2rem" height="2rem" className={styles.statIcon} />
              </div>
              <Skeleton width={s.w2} height="28px" />
              <div style={{ marginTop: "0.5rem" }}>
                <Skeleton width={s.w3} height="12px" />
              </div>
            </div>
          ))}
        </div>

        <SectionTitle>3 — Lista con avatares (Últimas ventas / Usuarios)</SectionTitle>
        <div className={styles.dualDemoGrid}>
          <div className={styles.cardSkeleton}>
            <div className={styles.cardHeaderRow}>
              <Skeleton width="140px" height="18px" />
              <Skeleton width="60px" height="28px" style={{ borderRadius: "0.5rem" }} />
            </div>
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className={styles.listItem}>
                <Skeleton width="40px" height="40px" className={styles.listAvatar} />
                <div className={styles.listContent}>
                  <Skeleton width="65%" height="14px" />
                  <Skeleton width="40%" height="12px" />
                </div>
                <Skeleton width="80px" height="20px" />
              </div>
            ))}
          </div>

          <div className={styles.cardSkeleton}>
            <div className={styles.cardHeaderRow}>
              <Skeleton width="160px" height="18px" />
              <Skeleton width="72px" height="14px" />
            </div>
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className={styles.listItem}>
                <Skeleton width="36px" height="36px" className={styles.listAvatar} />
                <div className={styles.listContent}>
                  <Skeleton width="80%" height="14px" />
                  <Skeleton width="50%" height="12px" />
                </div>
                <Skeleton width="60px" height="24px" style={{ borderRadius: "0.375rem" }} />
              </div>
            ))}
          </div>
        </div>

        <SectionTitle>4 — Fila de productos (con miniatura y precios)</SectionTitle>
        <div className={styles.cardSkeleton}>
          <div className={styles.cardHeaderRow}>
            <Skeleton width="180px" height="18px" />
            <Skeleton width="200px" height="36px" style={{ borderRadius: "0.5rem" }} />
          </div>
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className={styles.productRow}>
              <Skeleton width="52px" height="52px" className={styles.productThumb} />
              <div className={styles.productInfo}>
                <Skeleton width={j % 2 === 0 ? "55%" : "70%"} height="14px" />
                <Skeleton width="35%" height="12px" />
              </div>
              <div className={styles.productPriceRow}>
                <Skeleton width="80px" height="20px" />
                <Skeleton width="72px" height="32px" style={{ borderRadius: "0.5rem" }} />
              </div>
            </div>
          ))}
        </div>

        <SectionTitle>5 — Gráficos y placeholders de gran tamaño</SectionTitle>
        <div className={styles.dualDemoGrid}>
          <div className={styles.chartBox}>
            <div className={styles.chartHeader}>
              <Skeleton width="160px" height="18px" />
            </div>
            <Skeleton width="100%" height="280px" style={{ borderRadius: "0.5rem" }} />
          </div>
          <div className={styles.chartBox}>
            <div className={styles.chartHeader}>
              <Skeleton width="180px" height="18px" />
            </div>
            <Skeleton width="100%" height="280px" style={{ borderRadius: "0.5rem" }} />
          </div>
        </div>

        <SectionTitle>6 — Perfil / Tarjeta de usuario</SectionTitle>
        <div className={styles.dualDemoGrid}>
          <div className={styles.profileCard}>
            <Skeleton width="88px" height="88px" className={styles.profileAvatar} />
            <div className={styles.profileInfoStack}>
              <Skeleton width="50%" height="20px" style={{ margin: "0 auto" }} />
              <Skeleton width="65%" height="14px" style={{ margin: "0 auto" }} />
              <Skeleton width="40%" height="12px" style={{ margin: "0.75rem auto 0" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
              <Skeleton width="120px" height="36px" style={{ borderRadius: "0.5rem" }} />
              <Skeleton width="100px" height="36px" style={{ borderRadius: "0.5rem" }} />
            </div>
          </div>

          <div className={styles.cardSkeleton}>
            <div className={styles.cardHeaderRow}>
              <Skeleton width="120px" height="18px" />
            </div>
            <div className={styles.formGroup}>
              <Skeleton width="80px" height="12px" />
              <Skeleton width="100%" height="40px" style={{ borderRadius: "0.5rem" }} />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <Skeleton width="90px" height="12px" />
                <Skeleton width="100%" height="40px" style={{ borderRadius: "0.5rem" }} />
              </div>
              <div className={styles.formGroup}>
                <Skeleton width="70px" height="12px" />
                <Skeleton width="100%" height="40px" style={{ borderRadius: "0.5rem" }} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <Skeleton width="100px" height="12px" />
              <Skeleton width="100%" height="40px" style={{ borderRadius: "0.5rem" }} />
            </div>
            <Skeleton width="140px" height="40px" style={{ borderRadius: "0.5rem", marginTop: "0.5rem" }} />
          </div>
        </div>

        <SectionTitle>7 — Dashboard completo (como el DashboardPage real)</SectionTitle>
        <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statHeader}>
                <Skeleton width="70px" height="14px" />
                <Skeleton width="2rem" height="2rem" className={styles.statIcon} />
              </div>
              <Skeleton width="90px" height="28px" />
              <div style={{ marginTop: "0.5rem" }}>
                <Skeleton width="120px" height="12px" />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.dualDemoGrid} style={{ marginBottom: "1.5rem" }}>
          <div className={styles.chartBox}>
            <div className={styles.chartHeader}>
              <Skeleton width="160px" height="18px" />
            </div>
            <Skeleton width="100%" height="280px" style={{ borderRadius: "0.5rem" }} />
          </div>
          <div className={styles.chartBox}>
            <div className={styles.chartHeader}>
              <Skeleton width="180px" height="18px" />
            </div>
            <Skeleton width="100%" height="280px" style={{ borderRadius: "0.5rem" }} />
          </div>
        </div>

        <div className={styles.dualDemoGrid}>
          {[1, 2].map((i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className={styles.cardHeaderRow}>
                <Skeleton width="180px" height="18px" />
              </div>
              {[1, 2, 3].map((j) => (
                <div key={j} style={{ marginBottom: "0.75rem" }}>
                  <Skeleton width="100%" height="48px" style={{ borderRadius: "0.5rem" }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ height: "2rem" }} />
      </div>
    </div>
  )
}
