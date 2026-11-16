// Tulay's own in-world code: the Filipino dressing of Seiza's grounds,
// loaded through Seiza's world extension hook (src/worlds/WorldExtension.tsx)
// only when Tulay runs. Seiza's hall and classroom are dressed by the
// "filipino" theme in world.json (banig, capiz; src/scene/materials.ts);
// what's here is what Tulay adds:
//
//   Kubo.tsx    a kubo hall for classes on the meadow, and beach cottages
//   Palms.tsx   coconut palms down the top of the beach
//   Fiesta.tsx  banderitas and string lights, and parols at Christmas
//   plan.ts     where all of it is, its seats, and its collision
import { useEffect, useMemo } from "react";
import type { WorldSceneProps } from "../../../src/worlds/WorldExtension";
import { setWorldObstacles } from "../../../src/scene/layout";
import { SeatPad } from "../../../src/scene/SeatPad";
import { Kubos } from "./Kubo";
import { Palms } from "./Palms";
import { Fiesta } from "./Fiesta";
import { tulayObstacles, tulaySeats } from "./plan";

export function Scene({ sit, occupiedSeatId }: WorldSceneProps) {
  useEffect(() => {
    setWorldObstacles(tulayObstacles());
    return () => setWorldObstacles([]);
  }, []);
  const seats = useMemo(tulaySeats, []);
  return (
    <>
      <Kubos />
      <Palms />
      <Fiesta />
      {sit && seats.map((seat) => <SeatPad key={seat.id} seat={seat} onSit={sit} occupied={occupiedSeatId === seat.id} />)}
    </>
  );
}
