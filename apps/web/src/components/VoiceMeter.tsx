"use client";

import { litBarsFromLevel } from "@/lib/webrtc";

export function VoiceMeter({
  level,
  bars = 5,
}: {
  level: number;
  bars?: number;
}) {
  const lit = litBarsFromLevel(level, bars);

  return (
    <span
      className="flex h-5 items-end gap-[3px]"
      aria-hidden
      title={`Ses ${lit}/${bars}`}
    >
      {Array.from({ length: bars }, (_, index) => {
        const on = index < lit;
        return (
          <span
            key={index}
            className={`w-[3px] rounded-full transition-colors duration-75 ${
              on ? "bg-acid" : "bg-white/20"
            }`}
            style={{ height: `${7 + index * 3}px` }}
          />
        );
      })}
    </span>
  );
}
