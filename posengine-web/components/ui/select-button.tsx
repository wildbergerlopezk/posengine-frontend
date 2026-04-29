import React, { forwardRef } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

export const SelectButton = forwardRef<HTMLButtonElement, SelectButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "border-input flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="flex-1 truncate text-left">{children}</span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </button>
    )
  }
)

SelectButton.displayName = "SelectButton"