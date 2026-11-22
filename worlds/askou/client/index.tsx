// Askou Village's own code in the world, loaded by Seiza's world extension hook (src/worlds/WorldExtension.tsx) only
// when the "askou" world runs.
//
// The world is SeiOU's campus model (world.json points at its model and navmesh; the lifts and room lights are SeiOU's
// own, reused). What is here is the village: every bot of Askou, UPOU's chatbot, stands on the campus as a figure
// under its own star (Village.tsx), and answers a visitor's question with what the running Askou service replies
// (api.ts, store.ts). Nothing is answered from this repository: without Askou the bots are there but cannot answer.
import { useEffect } from "react";
import { showWorldOverlay, type WorldSceneProps } from "../../../src/worlds/WorldExtension";
import { Lifts } from "../../seiou/client/Lifts";
import { RoomLights } from "../../seiou/client/RoomLights";
import { connect, leaveVillage } from "./store";
import { Village } from "./Village";
import { VillageHud } from "./VillageHud";

export function Scene({ warp, faceToward, getSelfPosition, findPath, worldState, setWorldState }: WorldSceneProps) {
  useEffect(() => {
    void connect();
    showWorldOverlay(<VillageHud />);
    return () => {
      leaveVillage();
      showWorldOverlay(null);
    };
  }, []);
  return (
    <>
      <Lifts warp={warp} worldState={worldState} setWorldState={setWorldState} />
      <RoomLights worldState={worldState} />
      <Village warp={warp} faceToward={faceToward} getSelfPosition={getSelfPosition} findPath={findPath} />
    </>
  );
}
