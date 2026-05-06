import { check } from '@tauri-apps/plugin-updater';
import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useState, useEffect, useRef } from 'react';

export function useAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const totalSize = useRef<number>(1); // guardamos contentLength acá

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
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
    if (!updateInfo) return;
    setDownloading(true);
    try {
      const update = await check();
      await update?.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          totalSize.current = event.data.contentLength ?? 1; // lo guardamos acá
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