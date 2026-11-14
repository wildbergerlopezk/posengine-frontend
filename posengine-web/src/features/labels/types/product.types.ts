/** Shape returned by the existing paginated GET /product endpoint. */
export interface ProductSearchResult {
  id: string
  name: string
  description?: string | null
  barcode?: string | null
  sku?: string | null
  price: number | string
  imageUrl?: string | null
  stock?: number | string | null
  unitType?: "UNIT" | "KG" | "G" | "L" | "ML" | "MG" | null
}

export interface ProductSearchPage {
  items: ProductSearchResult[]
  total: number
  page: number
  limit: number
}
