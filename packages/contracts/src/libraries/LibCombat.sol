// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// External
import { IUint256Component } from "solecs/interfaces/IUint256Component.sol";
import { getAddressById } from "solecs/utils.sol";
import "std-contracts/components/Uint32Component.sol";

// Components
import { RangeComponent, ID as RangeComponentID } from "../components/RangeComponent.sol";
import { LengthComponent, ID as LengthComponentID } from "../components/LengthComponent.sol";
import { RotationComponent, ID as RotationComponentID } from "../components/RotationComponent.sol";
import { PositionComponent, ID as PositionComponentID } from "../components/PositionComponent.sol";
import { HealthComponent, ID as HealthComponentID } from "../components/HealthComponent.sol";
import { FirepowerComponent, ID as FirepowerComponentID } from "../components/FirepowerComponent.sol";
import { LeakComponent, ID as LeakComponentID } from "../components/LeakComponent.sol";
import { OnFireComponent, ID as OnFireComponentID } from "../components/OnFireComponent.sol";
import { SailPositionComponent, ID as SailPositionComponentID } from "../components/SailPositionComponent.sol";
import { DamagedMastComponent, ID as DamagedMastComponentID } from "../components/DamagedMastComponent.sol";
import { CrewCountComponent, ID as CrewCountComponentID } from "../components/CrewCountComponent.sol";

// Types
import { Side, Coord } from "../libraries/DSTypes.sol";

// Libraries
import "./LibVector.sol";
import "./LibUtils.sol";
import { ABDKMath64x64 as Math } from "./ABDKMath64x64.sol";

library LibCombat {
  /**
   * @notice overview: increases damage as your firepower increases OR distance decreases
          equation: 80 * e^(-.008 * distance) * (firepower / 100), multiplied by 100 for precision
   * @param   distance  from target
   * @param   firepower  of attacker
   * @return  hitChance  based on above equation
   */
  function getBaseHitChance(uint256 distance, uint256 firepower) public view returns (uint256 hitChance) {
    int128 _scaleInv = Math.exp(Math.divu(distance * 8, 1000));
    int128 firepowerDebuff = Math.divu(firepower, 100);
    int128 beforeDebuff = Math.div(Math.fromUInt(8000), _scaleInv);
    hitChance = Math.toUInt(Math.mul(beforeDebuff, firepowerDebuff));
  }

  /**
   * @notice  calculates hull damage from base hit chance and randomly generated seed
   * @dev chance of 3 damage is base chance, 2 damage is 1.7x, 1 damage is 3.5x
   * @param   baseHitChance calculated using getBaseHitChance
   * @param   randomSeed calculated using randomness
   * @return  uint32 hull damage incurred
   */
  function getHullDamage(uint256 baseHitChance, uint256 randomSeed) public pure returns (uint32) {
    // use first 14 bits for hull damage (log_2(10000) = ~13.2)
    uint256 odds = (LibUtils.getByteUInt(randomSeed, 14, 0) * 10000) / 16384;
    if (odds <= baseHitChance) return 3;
    if (odds <= (baseHitChance * 170) / 100) return 2;
    if (odds <= (baseHitChance * 350) / 100) return 1;
    return 0;
  }

  /**
   * @notice  calculates crew damage from base hit chance and randomly generated seed
   * @dev     chance of 3 dead crew is base chance / 2, 2 dead crew is
   * @param   baseHitChance  calculated using getBaseHitChance
   * @param   randomSeed  calculated using randomness
   * @return  uint32  crew damage incurred
   */
  function getCrewDamage(uint256 baseHitChance, uint256 randomSeed) public pure returns (uint32) {
    // use second 14 bits for hull damage and then normalize result to 10
    // divide by 2 ** 14,
    uint256 odds = (LibUtils.getByteUInt(randomSeed, 14, 14) * 10000) / 16384;
    if (odds <= (baseHitChance * 50) / 100) return 3;
    if (odds <= baseHitChance) return 2;
    if (odds <= (baseHitChance * 200) / 100) return 1;
    return 0;
  }

  /**
   * @notice  calculates special chance from base hit chance, number of hits, and randomly generated seed
   * @dev     calculation: base chance ^ 2 / 5 -- makes dropoff more dramatic
   * @param   baseHitChance calculated using getBaseHitChance
   * @param   damage  calculated using getHullDamage
   * @param   randomSeed  calculated using randomness
   * @param   shift  used to produce different result for each type of special damage
   * @return  bool  did the special damage occur
   */
  function getSpecialChance(
    uint256 baseHitChance,
    uint256 damage,
    uint256 randomSeed,
    uint256 shift
  ) public view returns (bool) {
    // pre-shifted to account for hull and crew damage
    uint256 odds = ((LibUtils.getByteUInt(randomSeed, 14, (shift + 2) * 14)) * 10000) / 16384;
    odds = (odds * (((damage - 1) * 10) + 100)) / 100;

    uint256 outcome = ((baseHitChance**2) * 5) / 10000;
    return (odds <= outcome);
  }

  /**
   * @notice  calculates the location of four points comprising a trapezoidal firing area
   * @param   components  world components
   * @param   shipEntity  attacking ship entity
   * @param   side  of attack
   * @return  Coord[4]  points comprising firing area
   */
  function getFiringArea(
    IUint256Component components,
    uint256 shipEntity,
    Side side
  ) public view returns (Coord[4] memory) {
    uint32 range = RangeComponent(getAddressById(components, RangeComponentID)).getValue(shipEntity);
    Coord memory position = PositionComponent(getAddressById(components, PositionComponentID)).getValue(shipEntity);
    uint32 length = LengthComponent(getAddressById(components, LengthComponentID)).getValue(shipEntity);
    uint32 rotation = RotationComponent(getAddressById(components, RotationComponentID)).getValue(shipEntity);
    uint32 topRange = side == Side.Right ? 80 : 280;
    uint32 bottomRange = side == Side.Right ? 100 : 260;
    Coord memory sternLocation = LibVector.getSternLocation(position, rotation, length);
    Coord memory topCorner = LibVector.getPositionByVector(position, rotation, range, topRange);
    Coord memory bottomCorner = LibVector.getPositionByVector(sternLocation, rotation, range, bottomRange);

    return ([position, sternLocation, bottomCorner, topCorner]);
  }

  /**
   * @notice  damages enemy hull, crew, and special attacks
   * @param   components  world components
   * @param   attackerEntity  attacking entity
   * @param   defenderEntity  defending entity
   * @param   defenderPosition  location of defender
   */
  function damageEnemy(
    IUint256Component components,
    uint256 attackerEntity,
    uint256 defenderEntity,
    Coord memory defenderPosition
  ) public {
    Coord memory attackerPosition = PositionComponent(getAddressById(components, PositionComponentID)).getValue(
      attackerEntity
    );
    uint32 firepower = FirepowerComponent(getAddressById(components, FirepowerComponentID)).getValue(attackerEntity);
    uint256 distance = LibVector.distance(attackerPosition, defenderPosition);
    uint256 baseHitChance = getBaseHitChance(distance, firepower);

    // todo: make randomness more robust
    uint256 r = LibUtils.randomness(attackerEntity, defenderEntity);

    // perform hull and crew damage
    uint32 hullDamage = getHullDamage(baseHitChance, r);

    bool dead = damageUint32(components, HealthComponentID, hullDamage, defenderEntity);
    if (dead) return;

    dead = damageUint32(components, CrewCountComponentID, getCrewDamage(baseHitChance, r), defenderEntity);
    if (dead) return;

    if (hullDamage == 0) return;

    // perform special damage
    if (getSpecialChance(baseHitChance, hullDamage, r, 0)) {
      OnFireComponent(getAddressById(components, OnFireComponentID)).set(defenderEntity, 2);
    }
    if (getSpecialChance(baseHitChance, hullDamage, r, 3)) {
      LeakComponent(getAddressById(components, LeakComponentID));
    }
    if (getSpecialChance(baseHitChance, hullDamage, r, 1)) {
      DamagedMastComponent(getAddressById(components, DamagedMastComponentID)).set(defenderEntity, 2);
    }
    if (getSpecialChance(baseHitChance, hullDamage, r, 2)) {
      SailPositionComponent(getAddressById(components, SailPositionComponentID)).set(defenderEntity, 0);
    }
  }

  // used for crew and hull damage, abstraction reuses code
  /**
   * @notice  applies damage of type uint32
   * @dev     this is used to reuse code on hull and crew damage application
   * @param   components  world components
   * @param   componentID  type of component to update
   * @param   damage  amount of damage applied
   * @param   shipEntity  to apply damage to
   * @return  bool  if the damage killed the boat
   */
  function damageUint32(
    IUint256Component components,
    uint256 componentID,
    uint32 damage,
    uint256 shipEntity
  ) public returns (bool) {
    Uint32Component component = Uint32Component(getAddressById(components, componentID));
    uint32 value = component.getValue(shipEntity);

    if (value <= damage) {
      component.set(shipEntity, 0);
      return true;
    }

    component.set(shipEntity, value - damage);
    return false;
  }
}
