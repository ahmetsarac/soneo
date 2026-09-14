"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clampMenuPosition } from "@/lib/menu";

export function UserContextMenu({
  nickname,
  volume,
  x,
  y,
  onVolumeChange,
  onClose,
}: {
  nickname: string;
  volume: number;
  x: number;
  y: number;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const lastAudibleRef = useRef(volume > 0 ? volume : 1);
  const [pos, setPos] = useState({ left: x, top: y });

  if (volume > 0) lastAudibleRef.current = volume;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPos(
      clampMenuPosition(
        x,
        y,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      ),
    );
  }, [x, y]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const muted = volume === 0;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${nickname} menüsü`}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 w-64 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
    >
      <p className="truncate px-2.5 py-2 text-sm font-medium">{nickname}</p>
      <div className="mx-1 h-px bg-line" />
      <p className="px-2.5 pt-2 text-[10px] tracking-[0.16em] text-mist uppercase">
        Kullanıcı sesi
      </p>
      <label className="flex items-center gap-2 px-2.5 py-2">
        <span className="sr-only">{nickname} ses seviyesi</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-acid"
        />
        <span className="w-8 text-right text-[11px] tabular-nums text-mist">
          {Math.round(volume * 100)}
        </span>
      </label>
      <button
        type="button"
        role="menuitem"
        onClick={() => onVolumeChange(muted ? lastAudibleRef.current : 0)}
        className="w-full rounded-xl px-2.5 py-2 text-left text-sm hover:bg-white/6"
      >
        {muted ? "Sesi aç" : "Sessize al"}
      </button>
    </div>,
    document.body,
  );
}
