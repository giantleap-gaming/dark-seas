// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;

// External
import { getAddressById } from "solecs/utils.sol";
import { IUint256Component } from "solecs/interfaces/IUint256Component.sol";

// Components
import { ShipComponent, ID as ShipComponentID } from "../components/ShipComponent.sol";
import { PositionComponent, ID as PositionComponentID } from "../components/PositionComponent.sol";
import { LengthComponent, ID as LengthComponentID } from "../components/LengthComponent.sol";
import { RotationComponent, ID as RotationComponentID } from "../components/RotationComponent.sol";
import { GameConfigComponent, ID as GameConfigComponentID } from "../components/GameConfigComponent.sol";

// Types
import { Coord, GodID } from "../libraries/DSTypes.sol";

// Libraries
import { ABDKMath64x64 as Math } from "./ABDKMath64x64.sol";
import "trig/src/Trigonometry.sol";

library LibVector {
  //
  /**
   * @notice  calculates a final coord based on a move vector
   * @param   initialPosition  starting coordinate
   * @param   initialRotation  starting rotation
   * @param   distance  distance to move
   * @param   direction  direction to move
   * @return  Coord  final location
   */
  function getPositionByVector(
    Coord memory initialPosition,
    uint32 initialRotation,
    uint32 distance,
    uint32 direction
  ) internal pure returns (Coord memory) {
    uint32 angleDegs = (initialRotation + direction) % 360;

    uint256 angleRadsTimes10000 = uint256(angleDegs * 1745);

    uint256 angleRadsConverted = angleRadsTimes10000 * 1e13 + Trigonometry.TWO_PI;

    int256 newX = Trigonometry.cos(angleRadsConverted) * int32(distance);

    int256 newY = Trigonometry.sin(angleRadsConverted) * int32(distance);

    int32 finalX = int32(newX / 1e18) + initialPosition.x;
    int32 finalY = int32(newY / 1e18) + initialPosition.y;

    return Coord({ x: finalX, y: finalY });
  }

  /**
   * @notice  retrieves locations of both bow (front) and stern (back) of ship
   * @dev     bow is always the position and stern is calculated using getPositionByVector based on ship's rotation and length
   * @param   components  world components
   * @param   shipEntity  ship's entity id
   * @return  Coord  ship bow
   * @return  Coord  ship stern
   */
  function getShipBowAndSternLocation(IUint256Component components, uint256 shipEntity)
    public
    view
    returns (Coord memory, Coord memory)
  {
    ShipComponent shipComponent = ShipComponent(getAddressById(components, ShipComponentID));
    require(shipComponent.has(shipEntity), "LibVector: not a ship");

    PositionComponent positionComponent = PositionComponent(getAddressById(components, PositionComponentID));
    LengthComponent lengthComponent = LengthComponent(getAddressById(components, LengthComponentID));
    RotationComponent rotationComponent = RotationComponent(getAddressById(components, RotationComponentID));

    uint32 length = lengthComponent.getValue(shipEntity);
    uint32 rotation = rotationComponent.getValue(shipEntity);

    Coord memory shipPosition = positionComponent.getValue(shipEntity);
    Coord memory sternPosition = getSternLocation(shipPosition, rotation, length);

    return (shipPosition, sternPosition);
  }

  /**
   * @notice  calculates stern location based on length and bow position
   * @param   originPosition  bow position
   * @param   rotation  ship rotation
   * @param   length  ship length
   * @return  Coord  stern location
   */
  function getSternLocation(
    Coord memory originPosition,
    uint32 rotation,
    uint32 length
  ) internal pure returns (Coord memory) {
    return getPositionByVector(originPosition, rotation, length, 180);
  }

  /**
   * @notice  checks if a point is within a quadrilateral
   * @dev  uses the winding algorithm to calculate if point is within the polygon comprised of coords
   *       https://visualgo.net/en/polygon
   * @param   coords  locations of vertices of quadrilateral
   * @param   point  to check if within coords
   * @return  bool  is the point within the coords?
   */
  function withinPolygon(Coord[4] memory coords, Coord memory point) public pure returns (bool) {
    int32 wn = 0;
    for (uint32 i = 0; i < 4; i++) {
      Coord memory point1 = coords[i];
      Coord memory point2 = i == 3 ? coords[0] : coords[i + 1];

      int32 isLeft = ((point2.x - point1.x) * (point.y - point1.y)) - ((point.x - point1.x) * (point2.y - point1.y));
      if (isLeft == 0) return false;
      if (point1.y <= point.y && point2.y > point.y && isLeft > 0) wn++;
      else if (point1.y > point.y && point2.y <= point.y && isLeft < 0) wn--;
    }
    return wn != 0;
  }

  /**
   * @notice  calculates distance between two points
   * @param   a  origin
   * @param   b  destination
   * @return  uint256  distance
   */
  function distance(Coord memory a, Coord memory b) public pure returns (uint256) {
    int128 distanceSquared = (a.x - b.x)**2 + (a.y - b.y)**2;
    return Math.toUInt(Math.sqrt(Math.fromInt(distanceSquared)));
  }

  /**
   * @notice  checks if a position is within the radius of the world
   * @param   components  world components
   * @param   position  position to check if within radius
   * @return  bool  is within radius?
   */
  function inWorldRadius(IUint256Component components, Coord memory position) public view returns (bool) {
    uint32 worldRadius = GameConfigComponent(getAddressById(components, GameConfigComponentID))
      .getValue(GodID)
      .worldRadius;

    int32 distanceSquared = (position.x)**2 + (position.y)**2;

    return worldRadius**2 >= uint32(distanceSquared);
  }
}
