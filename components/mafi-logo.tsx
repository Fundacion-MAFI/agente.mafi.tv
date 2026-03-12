"use client";

import { cn } from "@/lib/utils";

type MafiLogoProps = {
  className?: string;
};

/**
 * MAFI.tv logo in current text color, for use in header and sidebar.
 * Uses the Original logo as a CSS mask so it inherits foreground color.
 */
export function MafiLogo({ className }: MafiLogoProps) {
  return (
    <span
      aria-hidden
      className={cn("block w-32 h-10 shrink-0", className)}
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/logo/svg/MAFI.tv%20Original.svg)",
        maskImage: "url(/logo/svg/MAFI.tv%20Original.svg)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "left center",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
      }}
    />
  );
}
