// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ITreasureHuntManager {
    function isParticipant(uint256 _huntId, address _player) external view returns (bool);
    function isHuntActive(uint256 _huntId) external view returns (bool);
    // Add other functions if needed for interaction
} 