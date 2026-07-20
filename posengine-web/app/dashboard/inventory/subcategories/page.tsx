import { Suspense } from "react"
import { SubcategoriesPage } from "@/src/features/subcategories/pages/SubcategoriesPage"

export default function Page() {
    return (
        <Suspense fallback={null}>
            <SubcategoriesPage />
        </Suspense>
    )
}
