import { Coins, Clock } from "lucide-react";
import styles from "./payments.module.css";

export default function ClientsPaymentsPage() {
    return (
        <div className={styles.container}>
            {/* Background Decorative Glowing Orbs */}
            <div className={styles.glowOrb1} />
            <div className={styles.glowOrb2} />

            {/* Blurred Mockup Content (The "things in the background" the user requested) */}
            <div className={styles.mockupContent}>
                {/* Header Mockup */}
                <div className={styles.mockupHeader}>
                    <div className={styles.mockupTitleBar} />
                    <div className={styles.mockupSubBar} />
                </div>

                {/* KPI Cards Mockup */}
                <div className={styles.mockupKpiGrid}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className={styles.mockupCard}>
                            <div className={styles.mockupCardHeader}>
                                <div className={styles.mockupCardLabel} />
                                <div className={styles.mockupCardIcon} />
                            </div>
                            <div className={styles.mockupCardVal} />
                            <div className={styles.mockupCardSub} />
                        </div>
                    ))}
                </div>

                {/* Main section Mockup */}
                <div className={styles.mockupMainSection}>
                    <div className={styles.mockupCol2}>
                        <div className={styles.mockupCard}>
                            <div className={styles.mockupCardLabel} style={{ width: '10rem' }} />
                            <div>
                                {[1, 2, 3, 4].map((j) => (
                                    <div key={j} className={styles.mockupRow}>
                                        <div className={styles.mockupItemLeft}>
                                            <div className={styles.mockupAvatar} />
                                            <div className={styles.mockupLines}>
                                                <div className={styles.mockupLine1} />
                                                <div className={styles.mockupLine2} />
                                            </div>
                                        </div>
                                        <div className={styles.mockupRowRight} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.mockupCard}>
                        <div className={styles.mockupCardLabel} style={{ width: '8rem' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[1, 2, 3].map((k) => (
                                <div key={k} style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div className={styles.mockupCardIcon} style={{ flexShrink: 0 }} />
                                    <div className={styles.mockupLines} style={{ width: '100%' }}>
                                        <div className={styles.mockupLine1} style={{ width: '75%' }} />
                                        <div className={styles.mockupLine2} style={{ width: '50%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Announcement Card (Floating glassmorphic container in the center) */}
            <div className={styles.overlay}>
                <div className={styles.announcementCard}>
                    {/* Decorative subtle border light effect */}
                    <div className={styles.cardTopBorder} />

                    {/* Animated Pulsing Icon Wrapper */}
                    <div className={styles.iconWrapper}>
                        <div className={styles.ping} />
                        <div className={styles.iconContainer}>
                            <Coins className={styles.icon} />
                        </div>
                    </div>

                    {/* Badges and Typography */}
                    <div className={styles.textSection}>
                        <span className={styles.badge}>
                            <Clock className={styles.badgeIcon} />
                            Próximamente
                        </span>
                        <h2 className={styles.title}>
                            Pagos de Deuda
                        </h2>
                    </div>

                    <p className={styles.description}>
                        Esta sección está en desarrollo. Pronto podrá registrar pagos de deudas de clientes.
                    </p>

                    {/* Minimalist Progress Indicator */}
                    <div className={styles.progressContainer}>
                        <div className={styles.progressText}>
                            <span>Estado del desarrollo</span>
                            <span>En progreso</span>
                        </div>
                        <div className={styles.progressBar}>
                            <div className={styles.progressFill} />
                        </div>
                    </div>

                    {/* Decorative Bottom Pattern */}
                    <div className={styles.footer}>
                        Módulo de Clientes • POS Engine
                    </div>
                </div>
            </div>
        </div>
    );
}


