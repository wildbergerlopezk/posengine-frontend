import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { addSelectedProduct, removeSelectedProduct, updateSelectedProductQuantity } from "../utils/label-selection.ts"
import { matchesLabelDraftScope, sanitizeLabelDraftProducts } from "../utils/label-draft.ts"
import type { LabelFormatId, LabelProduct, SelectedLabelProduct } from "../types/label.types"

export const LABEL_DRAFT_STORAGE_KEY = "posengine_labels_draft_v1"

interface LabelDraftState {
  selectedProducts: SelectedLabelProduct[]
  formatId: LabelFormatId
  scopeKey: string | null
  setFormatId: (formatId: LabelFormatId) => void
  addProduct: (product: LabelProduct, quantity: number) => void
  setQuantity: (productId: string, quantity: number) => void
  removeProduct: (productId: string) => void
  clearDraft: () => void
  startScope: (scopeKey: string) => void
}

const emptyDraft = {
  selectedProducts: [] as SelectedLabelProduct[],
  formatId: "small" as LabelFormatId,
  scopeKey: null as string | null,
}

export const useLabelDraftStore = create<LabelDraftState>()(
  persist(
    (set) => ({
      ...emptyDraft,
      addProduct: (product, quantity) => set((state) => ({
        selectedProducts: addSelectedProduct(state.selectedProducts, product, quantity),
      })),
      setQuantity: (productId, quantity) => set((state) => ({
        selectedProducts: updateSelectedProductQuantity(state.selectedProducts, productId, quantity),
      })),
      removeProduct: (productId) => set((state) => ({
        selectedProducts: removeSelectedProduct(state.selectedProducts, productId),
      })),
      setFormatId: (formatId) => set({ formatId }),
      clearDraft: () => set({ selectedProducts: [], formatId: "small" }),
      startScope: (scopeKey) => set((state) => (
        state.scopeKey === scopeKey
          ? {}
          : { ...emptyDraft, scopeKey }
      )),
    }),
    {
      name: LABEL_DRAFT_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: ({ selectedProducts, formatId, scopeKey }) => ({ selectedProducts, formatId, scopeKey }),
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<Pick<LabelDraftState, "selectedProducts" | "formatId" | "scopeKey">> | undefined
        const formatId = saved?.formatId === "large" ? "large" : "small"
        return {
          ...currentState,
          selectedProducts: sanitizeLabelDraftProducts(saved?.selectedProducts),
          formatId,
          scopeKey: typeof saved?.scopeKey === "string" ? saved.scopeKey : null,
        }
      },
    },
  ),
)

export async function hydrateLabelDraftForScope(scopeKey: string): Promise<boolean> {
  try {
    await useLabelDraftStore.persist.rehydrate()
  } catch {
    useLabelDraftStore.setState(emptyDraft)
  }

  const savedScope = useLabelDraftStore.getState().scopeKey
  const matches = matchesLabelDraftScope(savedScope, scopeKey)
  useLabelDraftStore.getState().startScope(scopeKey)
  return matches
}

export function clearLabelDraftOnLogout(): void {
  useLabelDraftStore.setState(emptyDraft)
  void useLabelDraftStore.persist.clearStorage()
}
