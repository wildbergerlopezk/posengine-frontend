"use client"

import { useState, useEffect, useCallback } from "react"
import { Building2, Save, Undo, MapPin, Globe, Phone, Mail, FileText, Upload, Calendar, Hash, FileCode, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { Header } from "@/src/shared/components/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
} from "@/components/ui/field"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import styles from "./BusinessConfigPage.module.css"  

export default function BusinessConfigPage() {
  const { accessToken } = useAuthStore()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [formData, setFormData] = useState({
    slug: "",
    legalName: "",
    tradeName: "",
    taxId: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    economicActivity: "",
    emissionPoint: "001-001",
    logoUrl: "",
    stampNumber: "",
    stampStartDate: "",
  })

  // Fetch company data from backend
  const fetchCompany = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/companies`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) throw new Error("Error al obtener los datos de la empresa")
      
      const data = await res.json()
      const companies = data.items || data
      
      if (companies && companies.length > 0) {
        const comp = companies[0]
        setCompanyId(comp.id)
        setFormData({
          slug: comp.slug || "",
          legalName: comp.legalName || "",
          tradeName: comp.tradeName || "",
          taxId: comp.taxId || "",
          address: comp.address || "",
          city: comp.city || "",
          state: comp.state || "",
          phone: comp.phone || "",
          email: comp.email || "",
          economicActivity: comp.economicActivity || "",
          emissionPoint: comp.emissionPoint || "001-001",
          logoUrl: comp.logoUrl || "",
          stampNumber: comp.stampNumber || "",
          stampStartDate: comp.stampStartDate ? comp.stampStartDate.split("T")[0] : "",
        })
        if (comp.logoUrl) {
          setLogoPreview(comp.logoUrl)
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la configuración")
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken) return
    setIsSaving(true)

    const websiteValue = formData.slug.trim()
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/

    if (!websiteValue) {
      toast.error("El sitio web es requerido")
      setIsSaving(false)
      return
    }

    if (!urlPattern.test(websiteValue)) {
      toast.error("Por favor, ingrese un sitio web válido (ej: https://elytechpy.es/)")
      setIsSaving(false)
      return
    }

    const formattedWebsite = /^(https?:\/\/)/i.test(websiteValue) 
      ? websiteValue 
      : `https://${websiteValue}`

    const payload = {
      slug: formattedWebsite.toLowerCase(),
      legalName: formData.legalName.trim(),
      tradeName: formData.tradeName?.trim() || null,
      taxId: formData.taxId.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      economicActivity: formData.economicActivity?.trim() || null,
      emissionPoint: formData.emissionPoint || "001-001",
      logoUrl: formData.logoUrl?.trim() || null,
      stampNumber: formData.stampNumber?.trim() || null,
      stampStartDate: formData.stampStartDate ? new Date(formData.stampStartDate).toISOString() : null,
    }

    try {
      let res
      if (companyId) {
        // Update
        res = await fetch(`${API_BASE_URL}/companies/${companyId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
      } else {
        // Create
        res = await fetch(`${API_BASE_URL}/companies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || "Error al guardar los cambios")
      }

      const savedComp = await res.json()
      setCompanyId(savedComp.id)
      toast.success("Configuración de negocio guardada exitosamente")
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
      }, 2000)
      fetchCompany()
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cambios")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    fetchCompany()
    toast.info("Formulario restablecido a los valores guardados")
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const uploadData = new FormData()
    uploadData.append("file", file)
    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: uploadData,
      })
      if (!res.ok) throw new Error("Error al subir la imagen")
      const data = await res.json()
      setLogoPreview(data.url)
      setFormData((prev) => ({ ...prev, logoUrl: data.url }))
      toast.success("Logo subido exitosamente")
    } catch (err: any) {
      toast.error(err.message || "Error al subir el logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span style={{ marginLeft: "0.5rem" }}>Cargando configuración...</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Header title="Configuración"/>
      <div className={styles.container}>
      <form onSubmit={handleSave}>
        <div className={styles.pageHeader}>
          <div className={styles.headerText}>
            <h2 className={styles.pageTitle}>Mi Negocio</h2>
            <p className={styles.pageSubtitle}>
              Configura los datos fiscales, sucursal principal y facturación de tu comercio.
            </p>
          </div>
          <br />
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={handleReset} className={`${styles.btn} ${styles.btnOutline}`}>
              <Undo className="w-4 h-4" />
              Deshacer
            </Button>
            <Button
              type="submit"
              disabled={isSaving || saveSuccess}
              className={`${styles.btn} ${saveSuccess ? styles.btnSuccess : styles.btnPrimary}`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Cambios Guardados
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>

        <div className={styles.formGrid} style={{ marginTop: "1.5rem" }}>
          {/* Left Column: General Info & Location */}
          <div className={styles.leftColumn}>
            {/* Section: Información General */}
            <Card className={styles.card}>
              <CardHeader className={styles.cardHeader}>
                <CardTitle className={styles.cardTitle}>
                  <Building2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  Información General
                </CardTitle>
                <CardDescription className={styles.cardDescription}>Datos básicos y fiscales del establecimiento.</CardDescription>
              </CardHeader>
              <CardContent className={styles.cardContent}>
                <FieldSet className={styles.fieldsGrid}>
                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="tradeName" className={styles.label}>Nombre Comercial *</FieldLabel>
                    <Input
                      id="tradeName"
                      name="tradeName"
                      value={formData.tradeName}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Ej. Mi Tiendita"
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="legalName" className={styles.label}>Razón Social *</FieldLabel>
                    <Input
                      id="legalName"
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                      placeholder="Ej. Comercial Pérez S.A."
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="taxId" className={styles.label}>RUC / ID Tributaria *</FieldLabel>
                    <Input
                      id="taxId"
                      name="taxId"
                      value={formData.taxId}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                      placeholder="Ej. 80012345-6"
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="slug" className={styles.label}>Sitio Web *</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <Globe className={styles.inputIcon} size={16} />
                      <Input
                        id="slug"
                        name="slug"
                        type="url"
                        value={formData.slug}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        required
                        placeholder="https://elytechpy.es/"
                      />
                    </div>
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="email" className={styles.label}>Correo Electrónico</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <Mail className={styles.inputIcon} size={16} />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        placeholder="contacto@negocio.com"
                      />
                    </div>
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="phone" className={styles.label}>Teléfono</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <Phone className={styles.inputIcon} size={16} />
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        placeholder="+595215551234"
                      />
                    </div>
                  </Field>
                </FieldSet>
              </CardContent>
            </Card>

            {/* Section: Ubicación */}
            <Card className={styles.card}>
              <CardHeader className={styles.cardHeader}>
                <CardTitle className={styles.cardTitle}>
                  <MapPin className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  Ubicación
                </CardTitle>
                <CardDescription className={styles.cardDescription}>Dirección física de la sucursal principal.</CardDescription>
              </CardHeader>
              <CardContent className={styles.cardContent}>
                <FieldSet className={styles.fieldsGrid}>
                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="address" className={styles.label}>Dirección *</FieldLabel>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                      placeholder="Calle, Número, Barrio"
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="city" className={styles.label}>Ciudad *</FieldLabel>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                      placeholder="Ej. Asunción"
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="state" className={styles.label}>Provincia / Estado</FieldLabel>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Ej. Central"
                    />
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel className={styles.label}>País</FieldLabel>
                    <Input
                      value="Paraguay"
                      className={styles.input}
                      disabled
                      style={{ opacity: 0.7, cursor: "not-allowed" }}
                    />
                  </Field>
                </FieldSet>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Logo, Plan and economicActivity/Facturación */}
          <div className={styles.rightColumn}>
            {/* Top Sub-Grid: Logo and Plan */}
            <div className={styles.topSubGrid}>
              {/* Logo Card */}
              <Card className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <CardTitle className={styles.cardTitle}>Logo del Negocio</CardTitle>
                  <CardDescription className={styles.cardDescription}>Aparecerá en los recibos.</CardDescription>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  <div className={styles.logoWrapper}>
                    <div className={styles.logoBox}>
                      {uploadingLogo ? (
                        <div className={styles.uploadPlaceholder}>
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span>Subiendo...</span>
                        </div>
                      ) : logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="Logo preview" className={styles.logoImage} />
                      ) : (
                        <div className={styles.uploadPlaceholder}>
                          <Building2 className="w-12 h-12 text-primary" style={{ color: "var(--primary)", opacity: 0.8 }} />
                          <span>Subir Logo</span>
                        </div>
                      )}
                      <label className={styles.uploadOverlay} style={{ pointerEvents: uploadingLogo ? "none" : "auto" }}>
                        <Upload className="w-4 h-4" />
                        {uploadingLogo ? "Subiendo..." : "Cambiar"}
                        <input type="file" accept="image/*" className={styles.fileInput} onChange={handleLogoUpload} disabled={uploadingLogo} />
                      </label>
                    </div>
                    <p className={styles.logoHint}>
                      Formatos recomendados: PNG o JPG. Tamaño máximo: 2MB.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Plan Card */}
              <Card className={styles.card} style={{ position: "relative" }}>
                <CardHeader className={styles.cardHeader} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <CardTitle className={styles.cardTitle}>Estado de Plan</CardTitle>
                  <span className="text-[10px] bg-yellow-600/20 text-yellow-500 font-bold px-2 py-0.5 rounded">En Desarrollo</span>
                </CardHeader>
                <CardContent className={styles.cardContent}>
                  <div className={styles.planDetailsList} style={{ filter: "blur(1px)", opacity: 0.6 }}>
                    <div className={styles.planDetailItem}>
                      <span className={styles.planDetailLabel}>Plan Actual:</span>
                      <span className={styles.planBadge}>********</span>
                    </div>
                    <div className={styles.planDetailItem}>
                      <span className={styles.planDetailLabel}>Vence:</span>
                      <span className={styles.planDetailVal}>** ***, ****</span>
                    </div>
                    <div className={styles.planDetailItem}>
                      <span className={styles.planDetailLabel}>Productos:</span>
                      <span className={styles.planDetailVal}>*********</span>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="w-full mt-6" disabled style={{ opacity: 0.5 }}>
                    Próximamente
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Section: Actividad Económica y Facturación */}
            <Card className={styles.card}>
              <CardHeader className={styles.cardHeader}>
                <CardTitle className={styles.cardTitle}>
                  <FileCode className="w-5 h-5 text-primary" style={{ color: "var(--primary)" }} />
                  Facturación y Actividad
                </CardTitle>
                <CardDescription className={styles.cardDescription}>Configuración de comprobantes y datos fiscales.</CardDescription>
              </CardHeader>
              <CardContent className={styles.cardContent}>
                <FieldSet className={styles.fieldsGrid}>
                  <Field className={styles.formRow} style={{ alignItems: "start" }}>
                    <FieldLabel htmlFor="economicActivity" className={styles.label} style={{ marginTop: "0.5rem" }}>Actividad Económica</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <FileText className={styles.inputIcon} size={16} style={{ top: "0.75rem" }} />
                      <textarea
                        id="economicActivity"
                        name="economicActivity"
                        value={formData.economicActivity}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon} ${styles.textarea}`}
                        rows={2}
                        placeholder="Venta de suministros de oficina y consultoría tecnológica avanzada."
                      />
                    </div>
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="emissionPoint" className={styles.label}>Punto de Emisión *</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <Hash className={styles.inputIcon} size={16} />
                      <Input
                        id="emissionPoint"
                        name="emissionPoint"
                        value={formData.emissionPoint}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        required
                        placeholder="Ej. 001"
                      />
                    </div>
                  </Field>

                  <Field className={styles.formRow}>
                    <FieldLabel htmlFor="stampNumber" className={styles.label}>Nro de Timbrado</FieldLabel>
                    <div className={styles.inputWrapper}>
                      <Hash className={styles.inputIcon} size={16} />
                      <Input
                        id="stampNumber"
                        name="stampNumber"
                        value={formData.stampNumber}
                        onChange={handleInputChange}
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        placeholder="Ej. 1134567890"
                      />
                    </div>
                  </Field>



                </FieldSet>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}
