// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "./interfaces/ITreasureHuntManager.sol";
// Consider adding Ownable for admin functions if needed later
// import "@openzeppelin/contracts/access/Ownable.sol";

contract HuntMapNFT is ERC721URIStorage /*, Ownable */ {
    uint256 private _nextTokenId;

    ITreasureHuntManager public immutable treasureHuntManager;
    mapping(uint256 => mapping(address => bool)) public hasMinted; // huntId => playerAddress => bool

    constructor(address _treasureHuntManagerAddress) ERC721("Hunt Map NFT", "HUNTMAP") /* Ownable(msg.sender) */ {
        require(_treasureHuntManagerAddress != address(0), "Invalid manager address");
        treasureHuntManager = ITreasureHuntManager(_treasureHuntManagerAddress);
        _nextTokenId = 1;
    }

    function mint(address _to, uint256 _huntId, string memory _tokenURI) public {
        // Check requirements using the TreasureHuntManager contract
        require(!treasureHuntManager.isHuntActive(_huntId), "Hunt must be finished");
        require(treasureHuntManager.isParticipant(_huntId, _to), "Recipient is not a participant");
        require(!hasMinted[_huntId][_to], "Already minted for this hunt");

        // Mark as minted for this hunt
        hasMinted[_huntId][_to] = true;

        // Mint the NFT
        uint256 tokenId = _nextTokenId;
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        // Increment counter manually
        _nextTokenId++;
    }

} 