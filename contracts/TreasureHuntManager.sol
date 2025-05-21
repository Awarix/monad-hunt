// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract TreasureHuntManager {

    address public admin; // Set in constructor
    mapping(uint256 => Hunt) public hunts; // Mapping from huntId to Hunt struct
    mapping(uint256 => bytes32) public treasureLocationHashes; // To verify treasure reveal

    struct Hunt {
        uint256 id; // Hunt ID from backend
        address creator; // Address that called createHunt
        uint8 treasureType; // For off-chain logic/rewards
        bytes32 treasureLocationHash; // Hash of treasureX, treasureY, salt
        uint8 currentX; // Current X position, starts at 4
        uint8 currentY; // Current Y position, starts at 4
        uint8 movesMade; // Number of successful moves
        uint8 maxMoves; // Maximum allowed moves for this hunt
        bool isActive; // True if hunt is ongoing
        bool treasureRevealed; // True if revealTreasure was successfully called
        bool treasureFoundAtReveal; // True if treasure revealed at current location while active
        address lastMover; // Address of the player who made the last move
        mapping(address => bool) participants; // Tracks who has made a move
        uint256 participantsCount; // Number of unique participants
        uint8 revealedTreasureX; // Stores X coordinate after successful reveal
        uint8 revealedTreasureY; // Stores Y coordinate after successful reveal
    }

    event HuntCreated(uint256 indexed huntId, address indexed creator, uint8 treasureType, bytes32 treasureLocationHash, uint8 initialX, uint8 initialY);
    event MoveMade(uint256 indexed huntId, address indexed player, uint8 newX, uint8 newY, uint8 moveNumber);
    event TreasureRevealed(uint256 indexed huntId, address indexed revealer, uint8 treasureX, uint8 treasureY);
    event HuntEnded(uint256 indexed huntId, bool treasureFoundByReveal, uint8 revealedTreasureX, uint8 revealedTreasureY);

    constructor() {
        admin = msg.sender;
    }

    function createHunt(
        uint256 _huntId,
        uint8 _treasureType,
        uint8 _maxMoves,
        bytes32 _treasureLocationHash
    ) public {
        require(hunts[_huntId].id == 0, "Hunt ID already exists");
        require(_maxMoves > 0, "Max moves must be greater than 0");

        Hunt storage newHunt = hunts[_huntId];

        newHunt.id = _huntId;
        newHunt.creator = msg.sender;
        newHunt.treasureType = _treasureType;
        newHunt.maxMoves = _maxMoves;
        newHunt.treasureLocationHash = _treasureLocationHash;
        newHunt.currentX = 4; // Starting X coordinate
        newHunt.currentY = 4; // Starting Y coordinate
        newHunt.movesMade = 0;
        newHunt.isActive = true;
        newHunt.treasureRevealed = false;
        newHunt.treasureFoundAtReveal = false;
        // lastMover, participants, participantsCount, revealedTreasureX/Y default to 0/false/empty

        // Store the hash in the separate mapping for reveal verification
        treasureLocationHashes[_huntId] = _treasureLocationHash;

        emit HuntCreated(
            _huntId,
            msg.sender,
            _treasureType,
            _treasureLocationHash,
            newHunt.currentX,
            newHunt.currentY
        );
    }

    function makeMove(uint256 _huntId, uint8 _targetX, uint8 _targetY) public {
        Hunt storage hunt = hunts[_huntId];

        // Requirement Checks
        require(hunt.isActive, "Hunt is not active");
        require(msg.sender != hunt.lastMover, "Cannot make two consecutive moves");
        require(_targetX < 10 && _targetY < 10, "Target coordinates out of bounds");
        require(hunt.movesMade < hunt.maxMoves, "Maximum moves reached");

        // Adjacency Check (Manhattan distance == 1)
        uint8 xDiff = _targetX > hunt.currentX ? _targetX - hunt.currentX : hunt.currentX - _targetX;
        uint8 yDiff = _targetY > hunt.currentY ? _targetY - hunt.currentY : hunt.currentY - _targetY;
        require(xDiff + yDiff == 1, "Move must be to an adjacent cell");

        // Update Hunt State
        hunt.currentX = _targetX;
        hunt.currentY = _targetY;
        hunt.movesMade++;
        hunt.lastMover = msg.sender;

        // Add participant if new
        if (!hunt.participants[msg.sender]) {
            hunt.participants[msg.sender] = true;
            hunt.participantsCount++;
        }

        // Emit Event
        emit MoveMade(_huntId, msg.sender, _targetX, _targetY, hunt.movesMade);

        // Check if hunt ends due to reaching max moves (and treasure not already found via reveal)
        if (hunt.movesMade == hunt.maxMoves && !hunt.treasureRevealed) {
            _endHunt(_huntId, false); // We will implement _endHunt next
        }
    }

    function _endHunt(uint256 _huntId, bool _foundByReveal) internal {
        Hunt storage hunt = hunts[_huntId];

        // Ensure we only end active hunts
        if (!hunt.isActive) {
            return; // Or revert("Hunt already ended"); depending on desired strictness
        }

        hunt.isActive = false;

        // Emit event with final state details
        emit HuntEnded(
            _huntId,
            _foundByReveal, // Indicates if ended due to finding treasure during reveal
            hunt.revealedTreasureX, // Will be 0 if not revealed
            hunt.revealedTreasureY  // Will be 0 if not revealed
        );
    }

    function revealTreasure(
        uint256 _huntId,
        uint8 _treasureX,
        uint8 _treasureY,
        bytes32 _salt
    ) public {
        Hunt storage hunt = hunts[_huntId];

        // Requirement Checks
        require(hunt.id != 0, "Hunt does not exist");
        require(!hunt.treasureRevealed, "Treasure already revealed");

        // Authorization Check
        bool isAuthorized = hunt.participants[msg.sender] ||
            msg.sender == hunt.creator ||
            msg.sender == admin;
        require(isAuthorized, "Not authorized to reveal treasure");

        // Hash Verification - Use abi.encodePacked to match server-side hashing
        bytes32 locationHash = keccak256(
            abi.encodePacked(_treasureX, _treasureY, _salt)
        );
        require(
            locationHash == hunt.treasureLocationHash,
            "Invalid treasure location or salt"
        );

        // Update State
        hunt.treasureRevealed = true;
        hunt.revealedTreasureX = _treasureX;
        hunt.revealedTreasureY = _treasureY;

        // Emit Event
        emit TreasureRevealed(_huntId, msg.sender, _treasureX, _treasureY);

        // Check if hunt ends due to finding treasure at current location
        if (
            hunt.isActive &&
            hunt.currentX == _treasureX &&
            hunt.currentY == _treasureY
        ) {
            hunt.treasureFoundAtReveal = true;
            _endHunt(_huntId, true); // End the hunt, marking treasure as found by reveal
        }
    }

    // --- View Functions ---

    function getHuntDetails(uint256 _huntId)
        public
        view
        returns (
            uint256 id,
            address creator,
            uint8 treasureType,
            bytes32 treasureLocationHash,
            uint8 currentX,
            uint8 currentY,
            uint8 movesMade,
            uint8 maxMoves,
            bool isActive,
            bool treasureRevealed,
            bool treasureFoundAtReveal,
            address lastMover,
            uint256 participantsCount,
            uint8 revealedTreasureX,
            uint8 revealedTreasureY
        )
    {
        Hunt storage hunt = hunts[_huntId];
        // require(hunt.id != 0, "Hunt does not exist"); // Optional: Reverts if hunt doesn't exist
        return (
            hunt.id,
            hunt.creator,
            hunt.treasureType,
            hunt.treasureLocationHash,
            hunt.currentX,
            hunt.currentY,
            hunt.movesMade,
            hunt.maxMoves,
            hunt.isActive,
            hunt.treasureRevealed,
            hunt.treasureFoundAtReveal,
            hunt.lastMover,
            hunt.participantsCount,
            hunt.revealedTreasureX,
            hunt.revealedTreasureY
        );
    }

    function isParticipant(uint256 _huntId, address _player) public view returns (bool) {
        // require(hunts[_huntId].id != 0, "Hunt does not exist"); // Optional: uncomment to revert for non-existent hunts
        return hunts[_huntId].participants[_player];
    }

    function isHuntActive(uint256 _huntId) public view returns (bool) {
        // Returns false for non-existent hunts as well, as their 'isActive' defaults to false.
        return hunts[_huntId].isActive;
    }

    function isHuntRevealed(uint256 huntId) public view returns (bool) {
        return hunts[huntId].treasureRevealed;
    }

    // <<< NEW GETTER FUNCTION FOR DEBUGGING >>>
    function getStoredTreasureLocationHash(uint256 huntId) public view returns (bytes32) {
        return treasureLocationHashes[huntId];
    }
    // <<< END NEW GETTER FUNCTION >>>

} 