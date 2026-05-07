"use client";
import { useState, useEffect, useRef } from 'react';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const totalSize = useRef<number>(1);

  useEffect(() => {
    if (!isTauri()) return; // 👈 no hacer nada en el browser
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    if (!isTauri()) return;
    try {
      const { check } = await import('@tauri-apps/plugin-updater'); // import dinámico
      const update = await check();
      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo({ version: update.version, body: update.body ?? '' });
      }
    } catch (e) {
      console.error('Update check failed:', e);
    }
  }

  async function installUpdate() {
    if (!updateInfo || !isTauri()) return;
    setDownloading(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      await update?.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalSize.current = event.data.contentLength ?? 1;
        } else if (event.event === 'Progress') {
          setProgress(Math.round((event.data.chunkLength / totalSize.current) * 100));
        }
      });
      await relaunch();
    } catch (e) {
      console.error('Install failed:', e);
      setDownloading(false);
    }
  }

  return { updateAvailable, updateInfo, downloading, progress, installUpdate };
}