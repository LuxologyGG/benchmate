"use client";

import type { BoundingBox } from "@/lib/types";

export function BoundingBoxOverlay({
  src,
  boxes,
  alt,
}: {
  src: string;
  boxes: BoundingBox[];
  alt: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-black/5" data-testid="bbox-overlay">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block h-auto w-full object-contain" />
      {boxes.map((box) => (
        <div
          key={box.id}
          className="pointer-events-none absolute border-2 border-teal-500/90 bg-teal-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        >
          <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {box.label} · {(box.confidence * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
