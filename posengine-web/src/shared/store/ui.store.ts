import { create } from "zustand"

interface UIStore {
  isShortcutsModalOpen: boolean
  toggleShortcutsModal: () => void
  openShortcutsModal: () => void
  closeShortcutsModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  isShortcutsModalOpen: false,
  toggleShortcutsModal: () => set((state) => ({ isShortcutsModalOpen: !state.isShortcutsModalOpen })),
  openShortcutsModal: () => set({ isShortcutsModalOpen: true }),
  closeShortcutsModal: () => set({ isShortcutsModalOpen: false }),
}))
