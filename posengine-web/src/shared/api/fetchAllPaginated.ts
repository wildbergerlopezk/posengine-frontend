const PAGE_SIZE = 100
const PARALLEL_PAGES = 4

interface PageResponse<T> {
  items?: T[]
  total?: number
}

async function readPage<T>(
  endpoint: string,
  accessToken: string,
  page: number,
  signal: AbortSignal,
): Promise<PageResponse<T> | T[]> {
  const separator = endpoint.includes("?") ? "&" : "?"
  const response = await fetch(
    `${endpoint}${separator}page=${page}&limit=${PAGE_SIZE}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    },
  )

  if (!response.ok) throw new Error("No se pudieron cargar los datos")
  return response.json()
}

/** Loads each server page once so local search and filters cover the full dataset. */
export async function fetchAllPaginated<T>(
  endpoint: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<T[]> {
  const firstPage = await readPage<T>(endpoint, accessToken, 1, signal)
  if (Array.isArray(firstPage)) return firstPage

  const firstItems = firstPage.items ?? []
  const totalPages = Math.ceil((firstPage.total ?? firstItems.length) / PAGE_SIZE)
  const items = [...firstItems]

  for (let firstPageNumber = 2; firstPageNumber <= totalPages; firstPageNumber += PARALLEL_PAGES) {
    const pageNumbers = Array.from(
      { length: Math.min(PARALLEL_PAGES, totalPages - firstPageNumber + 1) },
      (_, index) => firstPageNumber + index,
    )
    const pages = await Promise.all(
      pageNumbers.map((page) => readPage<T>(endpoint, accessToken, page, signal)),
    )

    for (const page of pages) {
      items.push(...(Array.isArray(page) ? page : page.items ?? []))
    }
  }

  return items
}
