"use client";

import { useEffect, useRef, useState } from "react";
import { ParticipantTile } from "@/components/ParticipantTile";
import type { Participant } from "@/lib/api";
import { TILE_GAP, meetGridColumns, meetGridLayout } from "@/lib/layout";

type TileModel = {
  participant: Participant;
  self: boolean;
  stream: MediaStream | null;
  cameraStream: MediaStream | null;
  level: number;
  micOn: boolean;
  camOn: boolean;
  iceState?: string;
  volume: number;
  presenting: boolean;
};

export function ParticipantGrid({
  tiles,
  presenterId,
  onVolumeChange,
}: {
  tiles: TileModel[];
  presenterId: string | null;
  onVolumeChange: (nickname: string, volume: number) => void;
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
  }, [presenterId]);

  const presenter = tiles.find((tile) => tile.participant.id === presenterId);

  if (presenter) {
    return (
      <div
        ref={hostRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row"
      >
        <div className="min-h-[14rem] min-w-0 flex-1 lg:min-h-0">
          <ParticipantTile
            {...presenter}
            presenting
            onVolumeChange={(value) =>
              onVolumeChange(presenter.participant.nickname, value)
            }
          />
        </div>
        <div className="flex h-28 shrink-0 gap-2 overflow-x-auto lg:h-auto lg:w-52 lg:flex-col lg:overflow-y-auto">
          {tiles.map((tile) => (
            <div
              key={tile.participant.id}
              className="h-full w-40 shrink-0 lg:h-28 lg:w-full"
            >
              <ParticipantTile
                {...tile}
                compact
                presenting={false}
                stream={tile.cameraStream}
                onVolumeChange={(value) =>
                  onVolumeChange(tile.participant.nickname, value)
                }
              />
            </div>
          ))}
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
        className={
          layout
            ? "flex flex-wrap content-center items-center justify-center"
            : "grid h-full w-full"
        }
        style={
          layout
            ? { gap: TILE_GAP }
            : {
                gridTemplateColumns: `repeat(${fallbackColumns}, minmax(0, 1fr))`,
                gridAutoRows: "minmax(0, 1fr)",
                gap: TILE_GAP,
              }
        }
      >
        {tiles.map((tile) => (
          <div
            key={tile.participant.id}
            className={layout ? "min-h-0 min-w-0" : "h-full min-h-0 min-w-0"}
            style={
              layout
                ? { width: layout.tileWidth, height: layout.tileHeight }
                : undefined
            }
          >
            <ParticipantTile
              {...tile}
              onVolumeChange={(value) =>
                onVolumeChange(tile.participant.nickname, value)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
