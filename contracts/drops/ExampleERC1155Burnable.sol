// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

error ClaimNotEligible();
error ExceedsTotalSupply();
error MintInactive();

contract ExampleERC1155 is ERC1155Supply, ERC1155Burnable, Ownable {
    bool public isMintActive = false;
    uint256 public maxSupply;
    string private baseURI;

    constructor() ERC1155("") {
    }

    function mintPublic(uint256 id, uint256 numMints) external {
        _mint(msg.sender, id, numMints, "");
    }

    function airdrop(address recipient, uint256 id, uint256 amount) external onlyOwner {
        _mint(recipient, id, amount, "");
    }

    function toggleIsMintActive() external onlyOwner {
        isMintActive = !isMintActive;
    }

    function setURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function uri(uint256 chapterId) public view override returns (string memory) {
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, Strings.toString(chapterId))) : baseURI;
    }

    function updateMaxSupply(uint256 _maxSupply) external onlyOwner {
        maxSupply = _maxSupply;
    }

    /*  
        @dev Derived contract must override function "_beforeTokenTransfer". 
        Two or more base classes define function with same name and parameter types.solidity(6480)
    */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
