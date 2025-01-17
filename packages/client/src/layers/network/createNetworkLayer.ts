import {
  createWorld,
  defineComponent,
  EntityID,
  EntityIndex,
  getComponentValue,
  getComponentValueStrict,
  hasComponent,
  Type,
} from "@latticexyz/recs";
import {
  createActionSystem,
  defineBoolComponent,
  defineCoordComponent,
  defineNumberComponent,
  defineStringComponent,
  setupMUDNetwork,
} from "@latticexyz/std-client";
import { defineLoadingStateComponent } from "./components";
import { setupDevSystems } from "./setup";

import { GodID } from "@latticexyz/network";
import { Coord } from "@latticexyz/utils";
import { defaultAbiCoder as abi, keccak256 } from "ethers/lib/utils";
import { SystemAbis } from "../../../../contracts/types/SystemAbis.mjs";
import { SystemTypes } from "../../../../contracts/types/SystemTypes";
import { Action, Phase } from "../../types";
import { defineMoveCardComponent } from "./components/MoveCardComponent";
import { defineWindComponent } from "./components/WindComponent";
import { GameConfig, getNetworkConfig } from "./config";

/**
 * The Network layer is the lowest layer in the client architecture.
 * Its purpose is to synchronize the client components with the contract components.
 */
export async function createNetworkLayer(config: GameConfig) {
  console.log("Network config", config);

  // --- WORLD ----------------------------------------------------------------------
  const world = createWorld();

  // --- COMPONENTS -----------------------------------------------------------------
  const components = {
    GameConfig: defineComponent(
      world,
      {
        startTime: Type.String,
        commitPhaseLength: Type.Number,
        revealPhaseLength: Type.Number,
        actionPhaseLength: Type.Number,
        worldRadius: Type.Number,
      },
      { id: "GameConfig", metadata: { contractId: "ds.component.GameConfig" } }
    ),
    LoadingState: defineLoadingStateComponent(world),
    Wind: defineWindComponent(world),
    MoveCard: defineMoveCardComponent(world),
    Position: defineCoordComponent(world, { id: "Position", metadata: { contractId: "ds.component.Position" } }),
    Rotation: defineNumberComponent(world, { id: "Rotation", metadata: { contractId: "ds.component.Rotation" } }),
    Length: defineNumberComponent(world, { id: "Length", metadata: { contractId: "ds.component.Length" } }),
    Range: defineNumberComponent(world, { id: "Range", metadata: { contractId: "ds.component.Range" } }),
    Health: defineNumberComponent(world, { id: "Health", metadata: { contractId: "ds.component.Health" } }),
    Ship: defineBoolComponent(world, { id: "Ship", metadata: { contractId: "ds.component.Ship" } }),
    SailPosition: defineNumberComponent(world, {
      id: "SailPosition",
      metadata: { contractId: "ds.component.SailPosition" },
    }),
    CrewCount: defineNumberComponent(world, { id: "CrewCount", metadata: { contractId: "ds.component.CrewCount" } }),
    DamagedMast: defineNumberComponent(world, {
      id: "DamagedMast",
      metadata: { contractId: "ds.component.DamagedMast" },
    }),
    Leak: defineBoolComponent(world, { id: "Leak", metadata: { contractId: "ds.component.Leak" } }),
    OnFire: defineNumberComponent(world, { id: "OnFire", metadata: { contractId: "ds.component.OnFire" } }),
    Firepower: defineNumberComponent(world, { id: "Firepower", metadata: { contractId: "ds.component.Firepower" } }),
    LastMove: defineNumberComponent(world, { id: "LastMove", metadata: { contractId: "ds.component.LastMove" } }),
    LastAction: defineNumberComponent(world, { id: "LastAction", metadata: { contractId: "ds.component.LastAction" } }),
    OwnedBy: defineComponent(
      world,
      { value: Type.Entity },
      { id: "OwnedBy", metadata: { contractId: "ds.component.OwnedBy" } }
    ),
    Player: defineBoolComponent(world, { id: "Player", metadata: { contractId: "ds.component.Player" } }),
    Name: defineStringComponent(world, { id: "Name", metadata: { contractId: "ds.component.Name" } }),
    Commitment: defineStringComponent(world, { id: "Commitment", metadata: { contractId: "ds.component.Commitment" } }),
  };

  // --- SETUP ----------------------------------------------------------------------
  const { txQueue, systems, txReduced$, network, startSync, encoders } = await setupMUDNetwork<
    typeof components,
    SystemTypes
  >(getNetworkConfig(config), world, components, SystemAbis);

  // --- UTILITIES ------------------------------------------------------------------
  const getGameConfig = () => {
    const godEntityIndex = world.entityToIndex.get(GodID);
    if (godEntityIndex == null) return;

    return getComponentValue(components.GameConfig, godEntityIndex);
  };

  function getPlayerEntity(address?: string): EntityIndex | undefined {
    if (!address) address = network.connectedAddress.get();
    if (!address) return;
    const playerEntity = world.entityToIndex.get(address as EntityID);
    if (playerEntity == null || !hasComponent(components.Player, playerEntity)) return;

    return playerEntity;
  }

  function getPhase(): Phase | undefined {
    const gamePhase = getGamePhaseAt(Math.floor(network.clock.currentTime / 1000));
    return gamePhase;
  }

  function getGamePhaseAt(timeInSeconds: number): Phase | undefined {
    const gameConfig = getGameConfig();
    if (!gameConfig) return undefined;
    const timeElapsed = timeInSeconds - parseInt(gameConfig.startTime);
    const gameLength = gameConfig.commitPhaseLength + gameConfig.revealPhaseLength + gameConfig.actionPhaseLength;

    const secondsIntoTurn = timeElapsed % gameLength;

    if (secondsIntoTurn < gameConfig.commitPhaseLength) return Phase.Commit;
    if (secondsIntoTurn < gameConfig.commitPhaseLength + gameConfig.revealPhaseLength) return Phase.Reveal;
    return Phase.Action;
  }

  function getTurn(): number | undefined {
    const gamePhase = getGameTurnAt(network.clock.currentTime / 1000);
    return gamePhase;
  }

  function getGameTurnAt(timeInSeconds: number): number | undefined {
    const gameConfig = getGameConfig();
    if (!gameConfig) return undefined;
    const timeElapsed = timeInSeconds - parseInt(gameConfig.startTime);
    const turnLength = gameConfig.commitPhaseLength + gameConfig.revealPhaseLength + gameConfig.actionPhaseLength;

    return Math.floor(timeElapsed / turnLength);
  }

  function checkActionPossible(action: Action, ship: EntityIndex): boolean {
    const onFire = getComponentValue(components.OnFire, ship)?.value;
    if (action == Action.ExtinguishFire && !onFire) return false;
    if (action == Action.FireRight && onFire) return false;
    if (action == Action.FireLeft && onFire) return false;

    if (action == Action.RepairLeak && !getComponentValue(components.Leak, ship)) return false;
    if (action == Action.RepairMast && !getComponentValue(components.DamagedMast, ship)) return false;

    const sailPosition = getComponentValueStrict(components.SailPosition, ship).value;
    if (action == Action.LowerSail && sailPosition <= 1) return false;
    if (action == Action.RaiseSail && sailPosition >= 3) return false;
    if (action == Action.RepairSail && sailPosition > 0) return false;

    return true;
  }

  // --- ACTION SYSTEM --------------------------------------------------------------
  const actions = createActionSystem(world, txReduced$);

  // --- API ------------------------------------------------------------------------

  function commitMove(encoding: string) {
    const commitment = keccak256(encoding);
    console.log("committing move");
    systems["ds.system.Commit"].executeTyped(commitment);
  }

  function spawnPlayer(name: string) {
    const location: Coord = { x: Math.round(Math.random() * 300000), y: Math.round(Math.random() * 300000) };
    console.log("spawning player");
    systems["ds.system.PlayerSpawn"].executeTyped(name, location);
  }

  function spawnShip(location: Coord, rotation: number) {
    console.log("spawning ship");
    systems["ds.system.ShipSpawn"].executeTyped(location, rotation);
  }

  function revealMove(encoding: string) {
    console.log("revealing move");
    const decodedMove = abi.decode(["uint256[]", "uint256[]", "uint256"], encoding);
    systems["ds.system.Move"].executeTyped(decodedMove[0], decodedMove[1], decodedMove[2]);
  }

  function submitActions(ships: EntityID[], actions: Action[][]) {
    console.log("submitting actions");
    systems["ds.system.Action"].executeTyped(ships, actions);
  }

  // --- CONTEXT --------------------------------------------------------------------
  const context = {
    world,
    components,
    txQueue,
    systems,
    txReduced$,
    startSync,
    network,
    actions,
    utils: { getGameConfig, getPlayerEntity, getPhase, getGamePhaseAt, getTurn, checkActionPossible },
    api: { spawnShip, revealMove, submitActions, spawnPlayer, commitMove },
    dev: setupDevSystems(world, encoders, systems),
  };

  return context;
}
