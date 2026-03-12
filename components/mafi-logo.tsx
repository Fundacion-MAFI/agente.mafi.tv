"use client";

type MafiLogoProps = {
  className?: string;
};

/**
 * MAFI.tv logo in current text color, for use in header.
 * Uses the Original logo as a CSS mask so it inherits foreground color.
 */
export function MafiLogo({ className }: MafiLogoProps) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: "8rem",
        height: "2.5rem",
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
