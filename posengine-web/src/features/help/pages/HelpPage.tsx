"use client"

import { Sparkles, ArrowUpRight } from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import styles from "./HelpPage.module.css"

const WHATSAPP_NUMBER = "595974198790" // formato internacional sin espacios ni +
const WHATSAPP_MESSAGE = "Hola! Tengo una consulta sobre PosEngine."
const EMAIL = "elytechsys@gmail.com"

export function HelpPage() {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
  const mailUrl = `mailto:${EMAIL}?subject=${encodeURIComponent("Consulta sobre PosEngine")}`

  return (
    <div className={styles.page}>
      <Header title="Ayuda y Soporte" />

      <div className={styles.container}>
        <div className={styles.introCard}>
          <Sparkles size={36} className={styles.introIcon} />
          <h1>Estamos construyendo PosEngine junto a vos</h1>
          <p>
            El sistema sigue sumando funciones todo el tiempo. En vez de una guía que
            se desactualiza rápido, preferimos estar a un mensaje de distancia:
            escribinos directamente y te respondemos lo antes posible.
          </p>
        </div>

        <div className={styles.contactGrid}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.contactCard} ${styles.whatsappCard}`}
          >
            <div className={styles.contactIconWrap}>
              <img
                src="/whatsappIcon.png"
                alt="WhatsApp"
                width="32"
                height="32"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div className={styles.contactInfo}>
              <h3>WhatsApp</h3>
              <p>Respuesta rápida para dudas del día a día</p>
              <span className={styles.contactValue}>+595 0974 198790</span>
            </div>
            <ArrowUpRight size={20} className={styles.contactArrow} />
          </a>

          <a
            href={mailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.contactCard} ${styles.emailCard}`}
          >
            <div className={styles.contactIconWrap}>
              <img
                src="/gmailIcon.png"
                alt="Gmail"
                width="32"
                height="32"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div className={styles.contactInfo}>
              <h3>Correo</h3>
              <p>Para consultas más detalladas o formales</p>
              <span className={styles.contactValue}>{EMAIL}</span>
            </div>
            <ArrowUpRight size={20} className={styles.contactArrow} />
          </a>
        </div>
      </div>
    </div>
  )
}