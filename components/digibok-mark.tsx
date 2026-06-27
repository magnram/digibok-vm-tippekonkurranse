import { cn } from "@/lib/utils"

// DigiBok's logo (open book + signal waves on slate, with wordmark). The asset
// lives at public/img.png; this just renders it at the requested size.
export function DigiBokMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/img.png"
      alt="DigiBok"
      className={cn("block object-contain", className)}
      loading="lazy"
    />
  )
}
