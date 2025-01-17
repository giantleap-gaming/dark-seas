import { GodID, SyncState } from "@latticexyz/network";
import { getComponentValue } from "@latticexyz/recs";
import { concat, map } from "rxjs";
import { BootScreen, registerUIComponent } from "../engine";

export function registerLoadingState() {
  registerUIComponent(
    "LoadingState",
    {
      rowStart: 1,
      rowEnd: 13,
      colStart: 1,
      colEnd: 13,
    },
    (layers) => {
      const {
        components: { LoadingState },
        world,
      } = layers.network;

      return concat([1], LoadingState.update$).pipe(
        map(() => ({
          LoadingState,
          world,
        }))
      );
    },

    ({ LoadingState, world }) => {
      const GodEntityIndex = world.entityToIndex.get(GodID);

      const loadingState = GodEntityIndex == null ? null : getComponentValue(LoadingState, GodEntityIndex);
      if (loadingState == null) {
        return <BootScreen initialOpacity={1}>Connecting</BootScreen>;
      }

      if (loadingState.state !== SyncState.LIVE) {
        return <BootScreen initialOpacity={1}>{loadingState.msg}</BootScreen>;
      }

      return null;
    }
  );
}
