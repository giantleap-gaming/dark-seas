import React from "react";
import { registerUIComponent } from "../engine";
import { EntityIndex, getComponentValue, getComponentValueStrict, setComponent } from "@latticexyz/recs";
import { map, merge, of } from "rxjs";
import { GodID } from "@latticexyz/network";
import { Button, colors, Container } from "../styles/global";
import { Action, ActionImg, ActionNames, SailPositions } from "../../../constants";
import Sails from "./OverviewComponents/Sails";
import AttackButton from "./OverviewComponents/AttackButton";
import styled from "styled-components";
import HullHealth from "./OverviewComponents/HullHealth";
import ShipAttribute from "./OverviewComponents/ShipAttribute";
import { SelectionType, ShipAttributeTypes } from "../../phaser/constants";

export function registerShipOverview() {
  registerUIComponent(
    // name
    "ShipOverview",
    // grid location
    {
      rowStart: 1,
      rowEnd: 10,
      colStart: 10,
      colEnd: 13,
    },
    // requirement
    (layers) => {
      const {
        network: {
          world,
          api: { submitActions },
          components: { Health, SailPosition, CrewCount, DamagedSail, Firepower, Leak, OnFire },
        },
        phaser: {
          components: { SelectedShip, Selection, SelectedActions },
        },
      } = layers;

      return merge(
        of(0),
        Health.update$,
        SelectedShip.update$,
        SailPosition.update$,
        CrewCount.update$,
        DamagedSail.update$,
        Firepower.update$,
        Leak.update$,
        OnFire.update$,
        Selection.update$,
        SelectedActions.update$
      ).pipe(
        map(() => {
          return {
            world,
            SelectedShip,
            Health,
            SailPosition,
            CrewCount,
            DamagedSail,
            Firepower,
            Leak,
            OnFire,
            Selection,
            SelectedActions,
            submitActions,
          };
        })
      );
    },
    ({
      world,
      SelectedShip,
      Health,
      SailPosition,
      CrewCount,
      DamagedSail,
      Firepower,
      Leak,
      OnFire,
      Selection,
      SelectedActions,
      submitActions,
    }) => {
      const GodEntityIndex: EntityIndex = world.entityToIndex.get(GodID) || (0 as EntityIndex);

      const shipEntity = getComponentValue(SelectedShip, GodEntityIndex)?.value as EntityIndex | undefined;
      if (!shipEntity) {
        return <></>;
      }

      const health = getComponentValueStrict(Health, shipEntity).value;
      const firepower = getComponentValueStrict(Firepower, shipEntity).value;
      const leak = getComponentValue(Leak, shipEntity);
      const onFire = getComponentValue(OnFire, shipEntity);
      const damagedSail = getComponentValue(DamagedSail, shipEntity);
      const crewCount = getComponentValueStrict(CrewCount, shipEntity).value;
      const sailPosition = getComponentValueStrict(SailPosition, shipEntity).value as SailPositions;
      const selection = getComponentValue(Selection, GodEntityIndex)?.value;

      const shipActions = getComponentValue(SelectedActions, shipEntity);

      const ActionButton = ({ index }: { index: SelectionType }) => {
        const action = shipActions && shipActions.value[index] ? shipActions.value[index] : undefined;
        return (
          <Button
            isSelected={index == selection}
            onClick={() => {
              setComponent(Selection, GodEntityIndex, { value: index });
            }}
            key={`action-button-${index}`}
          >
            {action && action !== -1 ? (
              <>
                <img src={ActionImg[action]} style={{ height: "80%", objectFit: "scale-down" }} />
                <p>{ActionNames[action]}</p>
              </>
            ) : (
              <p>Choose Action {index}</p>
            )}
          </Button>
        );
      };

      const handleSubmit = () => {
        if (!shipActions) return;
        const actionEntities = shipActions.value.filter((element) => element >= 0);
        submitActions(world.entities[shipEntity], actionEntities);
      };

      return (
        <Container style={{ paddingBottom: "0" }}>
          <BorderContainer>
            <ShipName style={{}}>{shipEntity.toString().slice(0, 7)}</ShipName>
            <OverviewContainer>
              <div style={{ width: "100%" }}>
                <HullHealth health={health} />
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <ShipAttribute attributeType={ShipAttributeTypes.Firepower} attribute={crewCount} />
                  <ShipAttribute attributeType={ShipAttributeTypes.Crew} attribute={firepower} />
                  <ShipAttribute attributeType={ShipAttributeTypes.Sails} attribute={SailPositions[sailPosition]} />
                </div>
              </div>
              <ActionsContainer>
                <ActionButtons>
                  <ActionButton index={SelectionType.Action1} />
                  <ActionButton index={SelectionType.Action2} />
                  <ActionButton index={SelectionType.Action3} />
                </ActionButtons>
                <Button
                  onClick={handleSubmit}
                  disabled={!shipActions || shipActions.value.every((action) => (action = -1))}
                >
                  Submit Actions
                </Button>
              </ActionsContainer>
            </OverviewContainer>
          </BorderContainer>
        </Container>
      );
    }
  );
}

const borderThickness = 42;

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
  line-height: 20px;
`;

const ActionButtons = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
  gap: 6px;
  line-height: 20px;
`;

const OverviewContainer = styled(Container)`
  border-radius: 20px;
  background: ${colors.blue};
  width: calc(100% - ${borderThickness}px);
  height: calc(100% - ${borderThickness}px);
  justify-content: space-between;
`;

const BorderContainer = styled(Container)`
  background: ${colors.gold};
  border-radius: 20px;
`;

const ShipName = styled.div`
  position: absolute;
  top: 4;
  left: ${borderThickness};
  font-weight: 800;
  color: ${colors.darkBrown};
  line-height: 20px;
  font-size: 22px;
`;
