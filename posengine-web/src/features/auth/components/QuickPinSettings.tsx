"use client"

import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { quickPinApi } from '../api/quick-pin.api'
import { SixDigitPinInput } from './SixDigitPinInput'
import styles from './QuickPinSettings.module.css'

export function QuickPinSettings() {
  const [enabled, setEnabled] = useState(false)
  const [deviceAuthorized, setDeviceAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState<string[]>(() => Array.from({ length: 6 }, () => ''))
  const [confirmPin, setConfirmPin] = useState<string[]>(() => Array.from({ length: 6 }, () => ''))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    quickPinApi.status()
      .then((result) => {
        if (!mounted) return
        setEnabled(result.enabled)
        setDeviceAuthorized(result.deviceAuthorized)
      })
      .catch(() => { if (mounted) setStatusError(true) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const clearFields = () => {
    setPassword('')
    setPin(Array.from({ length: 6 }, () => ''))
    setConfirmPin(Array.from({ length: 6 }, () => ''))
  }

  const setup = async () => {
    setError('')
    setMessage('')
    if (!password) return setError('Ingresá tu contraseña actual.')
    if (!pin.every((digit) => /^\d$/.test(digit))) return setError('El PIN debe tener seis dígitos.')
    if (!confirmPin.every((digit) => /^\d$/.test(digit))) return setError('Confirmá los seis dígitos del PIN.')
    if (pin.join('') !== confirmPin.join('')) return setError('Los PIN no coinciden.')

    const wasEnabled = enabled
    setSaving(true)
    try {
      await quickPinApi.setup(password, pin.join(''), confirmPin.join(''))
      setEnabled(true)
      setDeviceAuthorized(true)
      setMessage(wasEnabled
        ? 'Código actualizado. Este dispositivo quedó autorizado por 30 días.'
        : 'Acceso rápido activado y dispositivo autorizado por 30 días.')
      clearFields()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo configurar el acceso rápido.')
    } finally {
      setSaving(false)
    }
  }

  const disable = async () => {
    setError('')
    setMessage('')
    if (!password) return setError('Ingresá tu contraseña actual para desactivar el acceso rápido.')

    setSaving(true)
    try {
      await quickPinApi.disable(password)
      setEnabled(false)
      setDeviceAuthorized(false)
      setMessage('El acceso rápido fue desactivado en todos los dispositivos.')
      clearFields()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo desactivar el acceso rápido.')
    } finally {
      setSaving(false)
    }
  }

  const revokeDevice = async () => {
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await quickPinApi.revokeDevice()
      setDeviceAuthorized(false)
      setMessage('Este dispositivo ya no puede acceder mediante PIN. El código de tu cuenta sigue configurado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo revocar el dispositivo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section} aria-labelledby="quick-pin-title">
      {loading ? (
        <p className={styles.statusMessage} role="status">Consultando configuración…</p>
      ) : statusError ? (
        <p className={styles.error} role="alert">No se pudo consultar la configuración del PIN. Recargá para volver a intentar.</p>
      ) : (
        <div className={styles.grid}>
          <div className={styles.overview}>
            <header className={styles.header}>
              <span className={styles.icon} aria-hidden="true"><LockKeyhole size={19} /></span>
              <div>
                <h2 id="quick-pin-title" className={styles.title}>Inicio de sesión rápido</h2>
                <p className={styles.description}>Configurá un PIN de seis dígitos para ingresar sin escribir tu correo y contraseña cada vez.</p>
              </div>
            </header>

            <div className={`${styles.status} ${enabled ? styles.statusActive : styles.statusInactive}`} role="status">
              <span className={styles.statusDot} aria-hidden="true" />
              {enabled ? 'El acceso rápido está activado.' : 'Todavía no configuraste un PIN.'}
            </div>

            {enabled && (
              <div className={`${styles.deviceState} ${deviceAuthorized ? styles.deviceActive : styles.deviceInactive}`} role="status">
                <span className={styles.statusDot} aria-hidden="true" />
                Dispositivo autorizado · {deviceAuthorized ? 'Activo' : 'No autorizado'}
              </div>
            )}

            <div className={styles.explainer}>
              <h3>¿Cómo funciona?</h3>
              <p>{enabled
                ? 'Ingresá tu contraseña actual para cambiar el PIN. También podés desactivar el acceso rápido o revocar este dispositivo.'
                : 'Ingresá tu contraseña actual, elegí un código de seis números y repetilo para confirmarlo. Este dispositivo quedará autorizado por 30 días.'}</p>
            </div>

            {enabled && deviceAuthorized && (
              <button type="button" className={styles.forgetButton} disabled={saving} onClick={revokeDevice}>
                Olvidar este dispositivo
              </button>
            )}
          </div>

          <div className={styles.formPanel}>
            <h3 className={styles.formTitle}>{enabled ? 'Cambiar código de acceso' : 'Configurar código de acceso'}</h3>
            <label className={styles.field}>
              <span>Contraseña actual</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); setMessage('') }}
                disabled={saving}
              />
            </label>

            <div className={styles.codeColumns}>
              <div className={styles.codeField}>
                <span className={styles.fieldLabel}>{enabled ? 'Nuevo PIN' : 'PIN de acceso rápido'}</span>
                <span className={styles.hint}>Seis dígitos.</span>
                <SixDigitPinInput label={enabled ? 'Nuevo PIN' : 'PIN de acceso rápido'} value={pin} onChange={setPin} disabled={saving} />
              </div>
              <div className={styles.codeField}>
                <span className={styles.fieldLabel}>Confirmar PIN</span>
                <span className={styles.hint}>Repetí el código.</span>
                <SixDigitPinInput label="Confirmar PIN" value={confirmPin} onChange={setConfirmPin} disabled={saving} />
              </div>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {message && <p className={styles.successMessage} role="status">{message}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveButton}
                disabled={saving || !password || !pin.every((digit) => /^\d$/.test(digit)) || !confirmPin.every((digit) => /^\d$/.test(digit)) || pin.join('') !== confirmPin.join('')}
                onClick={setup}
              >
                {saving ? 'Guardando…' : enabled ? 'Guardar nuevo PIN' : 'Activar acceso rápido'}
              </button>
              {enabled && (
                <button type="button" className={styles.disableButton} disabled={saving || !password} onClick={disable}>
                  Desactivar acceso rápido
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
