"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const LOGO_SVG = "/logo-sigma-plateado.svg";
const LOGO_PNG = encodeURI("/Logo Plateado.png");

type Props = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function SigmaLogo({
  className,
  width = 240,
  height = 56,
  priority = false,
}: Props) {
  const [src, setSrc] = useState(LOGO_PNG);

  return (
    <span
      className={cn(
        "inline-flex max-w-full overflow-hidden rounded-full",
        "animate-logo-silver-pulse",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="SIGMA AI AGENCY"
        width={width}
        height={height}
        className={cn(
          "block h-auto max-w-full rounded-full object-contain object-left",
          className,
        )}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={() => setSrc(LOGO_SVG)}
      />
    </span>
  );
}
