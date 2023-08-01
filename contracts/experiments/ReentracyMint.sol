// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC721Receiver } from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import { IERC721 } from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import { Ownable } from 'solady/src/auth/Ownable.sol';

error IncorrectAmountToMint();

interface TargetERC721 {
    function mintPublic(uint256) external payable;
}

contract ReentrancyMint is IERC721Receiver, Ownable {
    TargetERC721 public target;
    IERC721 public token;
    address public receiverAddr;
    uint256 public mintPrice;

    constructor() {}

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        return this.onERC721Received.selector; // Must return its Solidity selector to confirm the token transfer
    }

    function mint(uint256 numMints) public payable {
        if (msg.value % mintPrice != 0) revert IncorrectAmountToMint();
        target.mintPublic{ value: msg.value }(numMints);
        // token.transferFrom(address(this), owner(), tokenId);
    }

    function withdraw() public onlyOwner {
        (bool sent, ) = receiverAddr.call{ value: address(this).balance }('');
        require(sent);
    }

    function setTarget(address _targetAddr) external onlyOwner {
        target = TargetERC721(_targetAddr);
    }

    function setReceiver(address _receiverAddr) external onlyOwner {
        receiverAddr = _receiverAddr;
    }

    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        mintPrice = _mintPrice;
    }
}
