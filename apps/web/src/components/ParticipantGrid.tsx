"use client";

import { useEffect, useRef, useState } from "react";
import { ParticipantTile } from "@/components/ParticipantTile";
import type { Participant } from "@/lib/api";
import { TILE_GAP, meetGridColumns, meetGridLayout } from "@/lib/layout";
import { orderFilmstrip, type Surface } from "@/lib/presenters";

export type TileModel = {
  id: string;
  participant: Participant;
  self: boolean;
  stream: MediaStream | null;
  surface: Surface;
  level: number;
  micOn: boolean;
  camOn: boolean;
  iceState?: string;
  volume: number;
  presenting: boolean;
};

export function ParticipantGrid({
  tiles,
  focusedKey,
  onSelectTile,
  onStopWatch,
  onVolumeChange,
}: {
  tiles: TileModel[];
  focusedKey: string | null;
  onSelectTile: (key: string) => void;
  onStopWatch: () => void;
  onVolumeChange: (nickname: string, volume: number, surface: Surface) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      setSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 1 &&
          Math.abs(current.height - rect.height) < 1
        ) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [focusedKey]);

  const focused = tiles.find((tile) => tile.id === focusedKey);
  const strip = orderFilmstrip(tiles.filter((tile) => tile.id !== focusedKey));

  if (focused) {
    return (
      <div
        ref={hostRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="min-h-[14rem] min-w-0 flex-1 lg:min-h-0">
            <ParticipantTile
              participant={focused.participant}
              self={focused.self}
              stream={focused.stream}
              level={focused.level}
              micOn={focused.micOn}
              camOn={focused.camOn}
              iceState={focused.iceState}
              volume={focused.volume}
              presenting={focused.presenting}
              playAudio={!focused.self}
              watchAction={
                focused.presenting
                  ? {
                      kind: "stop",
                      label: "Yayını izlemeyi durdur",
                      onClick: onStopWatch,
                    }
                  : {
                      kind: "stop",
                      label: "Küçült",
                      onClick: onStopWatch,
                    }
              }
              onVolumeChange={(value) =>
                onVolumeChange(
                  focused.participant.nickname,
                  value,
                  focused.surface,
                )
              }
            />
          </div>
          <div className="flex h-28 shrink-0 gap-2 overflow-x-auto lg:h-full lg:min-h-0 lg:w-52 lg:flex-col lg:overflow-y-auto">
            {strip.map((tile) => (
              <div
                key={tile.id}
                className="h-full w-44 shrink-0 overflow-hidden lg:h-auto lg:w-full lg:aspect-video"
              >
                <ParticipantTile
                  participant={tile.participant}
                  self={tile.self}
                  stream={tile.stream}
                  level={tile.level}
                  micOn={tile.micOn}
                  camOn={tile.camOn}
                  iceState={tile.iceState}
                  volume={tile.volume}
                  presenting={tile.presenting}
                  compact
                  playAudio={!tile.self}
                  onSelect={
                    tile.presenting ? undefined : () => onSelectTile(tile.id)
                  }
                  watchAction={
                    tile.presenting
                      ? {
                          kind: "watch",
                          label: "İzle",
                          onClick: () => onSelectTile(tile.id),
                        }
                      : undefined
                  }
                  onVolumeChange={(value) =>
                    onVolumeChange(
                      tile.participant.nickname,
                      value,
                      tile.surface,
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const count = Math.max(tiles.length, 1);
  const measured = size.width > 0 && size.height > 0;
  const layout = measured
    ? meetGridLayout(count, size.width, size.height)
    : null;
  const fallbackColumns = meetGridColumns(count);

  return (
    <div
      ref={hostRef}
      className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div
        className={layout ? "grid" : "grid h-full w-full"}
        style={
          layout
            ? {
                gridTemplateColumns: `repeat(${layout.columns}, ${layout.tileWidth}px)`,
                gridAutoRows: `${layout.tileHeight}px`,
                gap: TILE_GAP,
              }
            : {
                gridTemplateColumns: `repeat(${fallbackColumns}, minmax(0, 1fr))`,
                gridAutoRows: "minmax(0, 1fr)",
                gap: TILE_GAP,
              }
        }
      >
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="h-full min-h-0 min-w-0"
            style={
              layout
                ? { width: layout.tileWidth, height: layout.tileHeight }
                : undefined
            }
          >
            <ParticipantTile
              participant={tile.participant}
              self={tile.self}
              stream={tile.stream}
              level={tile.level}
              micOn={tile.micOn}
              camOn={tile.camOn}
              iceState={tile.iceState}
              volume={tile.volume}
              presenting={tile.presenting}
              playAudio={!tile.self}
              onSelect={
                tile.presenting ? undefined : () => onSelectTile(tile.id)
              }
              watchAction={
                tile.presenting
                  ? {
                      kind: "watch",
                      label: "Yayını izle",
                      onClick: () => onSelectTile(tile.id),
                    }
                  : undefined
              }
              onVolumeChange={(value) =>
                onVolumeChange(tile.participant.nickname, value, tile.surface)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
