"use client";

import { useAppUpdater } from "@/hooks/useAppUpdater";
import styles from "./update-dialog.module.css";

export function UpdateDialog() {
  if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
    return null;
  }

  return <UpdateDialogInner />;
}

function UpdateDialogInner() {
  const { updateAvailable, updateInfo, downloading, progress, installUpdate } = useAppUpdater();

  if (!updateAvailable) return null;

  return (
    <div className={styles.updateBanner}>
      <p>
        Nueva version disponible: <strong>v{updateInfo?.version}</strong>
      </p>
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