import React, { useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useLayers, useEngineStore } from "../hooks";
import { filterNullishValues } from "@latticexyz/utils";
import { Cell } from "./Cell";
import styled from "styled-components";
import { GridConfiguration, UIComponent } from "../types";
import { useStream } from "@latticexyz/std-client";
import { Layers } from "../../../../types";

const UIGrid = styled.div`
  display: grid;
  overflow: hidden;
  grid-template-columns: repeat(12, 8.33%);
  grid-template-rows: repeat(12, 8.33%);
  position: absolute;
  left: 0;
  top: 0;
  height: 100vh;
  width: 100vw;
  pointer-events: none;
  z-index: 100;
`;

const UIComponentContainer: React.FC<{ gridConfig: GridConfiguration }> = React.memo(({ children, gridConfig }) => {
  const { colStart, colEnd, rowStart, rowEnd } = gridConfig;

  return (
    <Cell
      style={{
        gridRowStart: rowStart,
        gridRowEnd: rowEnd,
        gridColumnStart: colStart,
        gridColumnEnd: colEnd,
      }}
    >
      {children}
    </Cell>
  );
});

export const UIComponentRenderer: React.FC<{ layers: Layers; id: string; uiComponent: UIComponent }> = React.memo(
  ({ layers, id, uiComponent: { requirement, Render, gridConfig } }) => {
    const req = useMemo(() => requirement(layers), [requirement, layers]);
    const state = useStream(req);
    if (!state) return null;

    return (
      <UIComponentContainer key={`component-${id}`} gridConfig={gridConfig}>
        {<Render {...state} />}
      </UIComponentContainer>
    );
  }
);

export const ComponentRenderer: React.FC = observer(() => {
  const { UIComponents } = useEngineStore();
  const layers = useLayers();
  if (!layers) return null;

  return (
    <UIGrid>
      {filterNullishValues(
        // Iterate through all registered UIComponents
        // and return those whose requirements are fulfilled
        [...UIComponents.entries()].map(([id, uiComponent]) => {
          return (
            <UIComponentRenderer layers={layers} id={id} key={`componentRenderer-${id}`} uiComponent={uiComponent} />
          );
        })
      )}
    </UIGrid>
  );
});
