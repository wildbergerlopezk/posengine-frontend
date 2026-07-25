import { SkeletonDemoPage } from "@/src/features/sandbox/pages/SkeletonDemoPage"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Skeleton Demo - PosEngine",
  description: "Muestra de componentes Skeleton con efecto shimmer para estados de carga.",
}

export default function Page() {
  return <SkeletonDemoPage />
}
