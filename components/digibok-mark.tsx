import { cn } from "@/lib/utils"

// DigiBok's logo (open book + signal waves on slate, with wordmark). The asset
// lives at public/digibok-logo.png; this just renders it at the requested size.
export function DigiBokMark({ className, wcLogo }: { className?: string, wcLogo: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={wcLogo ? "/digibok-vm-logo.png" : "/digibok-logo.png"}
      alt="DigiBok"
      className={cn("block object-contain", className)}
      loading="lazy"
    />
  )
}
