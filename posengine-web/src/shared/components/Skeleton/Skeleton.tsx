import type { HTMLAttributes } from "react"
import styles from "./Skeleton.module.css"

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: string
  height?: string
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, ...style }}
      {...rest}
    />
  )
}
