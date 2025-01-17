// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;
import "std-contracts/components/BoolComponent.sol";

uint256 constant ID = uint256(keccak256("ds.component.Leak"));

// signals if an entity is a charger type
contract LeakComponent is BoolComponent {
  constructor(address world) BoolComponent(world, ID) {}
}
