"use client"

import { useEffect, useRef, useState } from "react"
import { apiClient } from "@/src/shared/api/apiClient"
import { isLatestSearchRequest, scheduleDebouncedSearch } from "../utils/search-control"
import type { ProductSearchPage, ProductSearchResult } from "../types/product.types"

export const LABEL_PRODUCT_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

export function useLabelProductSearch() {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<ProductSearchPage>({ items: [], total: 0, page: 1, limit: LABEL_PRODUCT_PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const latestRequestId = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++latestRequestId.current
    const executeSearch = async () => {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: String(LABEL_PRODUCT_PAGE_SIZE), page: String(page) })
      if (query.trim()) params.set("search", query.trim())

      try {
        const response = await apiClient.get<ProductSearchPage | ProductSearchResult[]>(`/product?${params}`, {
          signal: controller.signal,
        })
        const pageData = Array.isArray(response)
          ? { items: response, total: response.length, page, limit: LABEL_PRODUCT_PAGE_SIZE }
          : response
        if (!isLatestSearchRequest(requestId, latestRequestId.current, controller.signal)) return
        setResults({
          items: Array.isArray(pageData.items) ? pageData.items : [],
          total: Number.isFinite(pageData.total) ? pageData.total : 0,
          page: Number.isFinite(pageData.page) ? pageData.page : page,
          limit: Number.isFinite(pageData.limit) ? pageData.limit : LABEL_PRODUCT_PAGE_SIZE,
        })
      } catch (cause) {
        if (!isLatestSearchRequest(requestId, latestRequestId.current, controller.signal)) return
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar los productos")
        setResults({ items: [], total: 0, page, limit: LABEL_PRODUCT_PAGE_SIZE })
      } finally {
        if (isLatestSearchRequest(requestId, latestRequestId.current, controller.signal)) setLoading(false)
      }
    }
    const cancelDebounce = scheduleDebouncedSearch(() => { void executeSearch() }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelDebounce()
      controller.abort()
    }
  }, [query, page, requestVersion])

  const updateQuery = (value: string) => {
    latestRequestId.current += 1
    setQuery(value)
    setPage(1)
    setLoading(true)
    setError(null)
  }

  const updatePage = (nextPage: number) => {
    latestRequestId.current += 1
    setPage(nextPage)
    setLoading(true)
    setError(null)
  }

  return {
    query,
    setQuery: updateQuery,
    page,
    setPage: updatePage,
    results,
    loading,
    error,
    retry: () => {
      latestRequestId.current += 1
      setLoading(true)
      setError(null)
      setRequestVersion((current) => current + 1)
    },
  }
}
