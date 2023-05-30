// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721A, ERC721A } from "erc721a/contracts/ERC721A.sol";
import { ERC721AQueryable } from "erc721a/contracts/extensions/ERC721AQueryable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { IERC2981, ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { OperatorFilterer } from "closedsea/src/OperatorFilterer.sol";

contract ExampleERC721A is ERC721AQueryable, Ownable, OperatorFilterer, ERC2981 {
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           ERRORS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

	error AllowlistMintInactive();
	error CallerIsContract();
	error ExceedsTxnLimit();
	error ExceedsAllowlistLimit();
	error ExceedsTotalSupply();
	error InsufficientAmountSent();	
	error NoFundsToWithdraw();
	error NotOnAllowlist();
	error PublicMintInactive();
	error TransferFailed();

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           EVENTS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

	event UpdatedAllowlistMintPrice(uint256 allowlistMintPrice);
	event UpdatedBaseUri(string baseUri);
	event UpdatedIsPublicMintActive(bool isPublicMintActive);
	event UpdatedIsAllowlistMintActive(bool isAllowlistMintActive);
	event UpdatedMaxSupply(uint256 maxSupply);
	event UpdatedMaxPublicMints(uint256 maxPublicMints);
	event UpdatedMaxAllowlistMints(uint256 maxAllowlistMints);
	event UpdatedMerkleRoot(bytes32 merkleRoot);
	event UpdatedPublicMintPrice(uint256 publicMintPrice);

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           STORAGE                          */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
    uint256 public maxSupply = 5555;
    uint256 public maxPublicMints = 5;
    uint256 public maxAllowlistMints = 2;
    uint256 public publicMintPrice = 0.07 ether;
    uint256 public allowlistMintPrice = 0.05 ether;
    bool public isPublicMintActive;
    bool public isAllowlistMintActive;
    bool public operatorFilteringEnabled;
    string public baseTokenURI;
    bytes32 public merkleRoot;

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          MODIFIERS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Requires that the minter is not a contract, and mint amount does not exceed maximum supply
    modifier validTxn(uint256 nMints) {
        if (msg.sender != tx.origin) revert CallerIsContract();
        if (totalSupply() + nMints > maxSupply) revert ExceedsTotalSupply();
        _;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         CONSTRUCTOR                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    constructor() ERC721A("Example", "Example") {
		_registerForOperatorFiltering();
        operatorFilteringEnabled = true;
        _setDefaultRoyalty(msg.sender, 500);
	}

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        MINT FUNCTIONS                      */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Public mint when public sale is active
    function mintPublic(uint256 nMints) external payable validTxn(nMints) {
        if (!isPublicMintActive) revert PublicMintInactive();
        if (nMints > maxPublicMints) revert ExceedsTxnLimit();
        if (msg.value != publicMintPrice * nMints) revert InsufficientAmountSent();

        _mint(msg.sender, nMints);
    }

    /// @notice Allowlist mint when allowlist sale is active
    /// @dev Uses a Merkle tree to verify if address is on allowlist
    function mintAllowlist(bytes32[] calldata _proof, uint256 nMints) external payable validTxn(nMints) {
        bytes32 node = keccak256(abi.encodePacked(msg.sender));
        if (!isAllowlistMintActive) revert AllowlistMintInactive();
        if (!MerkleProof.verify(_proof, merkleRoot, node)) revert NotOnAllowlist();
        if (msg.value != allowlistMintPrice * nMints) revert InsufficientAmountSent();
        if (_numberMinted(msg.sender) + nMints > maxAllowlistMints) revert ExceedsAllowlistLimit();

        _mint(msg.sender, nMints);
    }

    /// @notice Reserved mints for owner
    /// @dev MAX_BATCH_SIZE enforces a fixed batch size when minting large quantities with ERC721A
    function mintReserve(uint256 nMints) external onlyOwner validTxn(nMints) {
		uint256 MAX_BATCH_SIZE = 5;
        uint256 remainder = nMints % MAX_BATCH_SIZE;
        unchecked {
            uint256 nBatches = nMints / MAX_BATCH_SIZE;
            for (uint256 i; i < nBatches; ++i) {
                _mint(msg.sender, MAX_BATCH_SIZE);
            }
        }
        if (remainder != 0) {
            _mint(msg.sender, remainder);
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    	 SETTER FUNCTIONS                     */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

	function setMaxSupply(uint256 _maxSupply) external onlyOwner {
		maxSupply = _maxSupply;
		emit UpdatedMaxSupply(_maxSupply);
	}

	function setMaxPublicMints(uint256 _maxPublicMints) external onlyOwner {
		maxPublicMints = _maxPublicMints;
		emit UpdatedMaxSupply(_maxPublicMints);
	}

	function setMaxAllowlistMints(uint256 _maxAllowlistMints) external onlyOwner {
		maxAllowlistMints = _maxAllowlistMints;
		emit UpdatedMaxAllowlistMints(_maxAllowlistMints);
	}

	function setPublicMintPrice(uint256 _publicMintPrice) external onlyOwner {
		publicMintPrice = _publicMintPrice;
		emit UpdatedPublicMintPrice(_publicMintPrice);
	}

	function setAllowlistMintPrice(uint256 _allowlistMintPrice) external onlyOwner {
		allowlistMintPrice = _allowlistMintPrice;
		emit UpdatedAllowlistMintPrice(_allowlistMintPrice);
	}

    /// @notice Allows the owner to update the allowlist Merkle root hash
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
		emit UpdatedMerkleRoot(_merkleRoot);
    }

    /// @notice Allows the owner to set the base URI
    function setBaseURI(string calldata _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
		emit UpdatedBaseUri(_baseTokenURI);
    }

    /// @notice Allows the owner to flip the public mint state
    function toggleIsPublicMintActive() external onlyOwner {
        isPublicMintActive = !isPublicMintActive;
		emit UpdatedIsPublicMintActive(isPublicMintActive);
    }

    /// @notice Allows the owner to flip the allowlist sale state
    function toggleAllowlistMintActive() external onlyOwner {
        isAllowlistMintActive = !isAllowlistMintActive;
		emit UpdatedIsAllowlistMintActive(isAllowlistMintActive);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    HELPER/AUXILIARY FUNCTIONS              */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Allows contract to transfer and amount of funds to an address
    function _withdraw(address _address, uint256 _amount) private {
        (bool success, ) = payable(_address).call{ value: _amount }("");
        if (!success) revert TransferFailed();
    }

    /// @notice Allows the owner to withdraw and split contract funds
    function withdrawAll() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        if (contractBalance == 0) revert NoFundsToWithdraw();

        _withdraw(address(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045), (contractBalance * 15) / 100);
        _withdraw(address(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045), (contractBalance * 15) / 100);
        _withdraw(address(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045), address(this).balance);
    }

    /// @notice Override view function to get the base URI
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    /// @dev Allows contract to receive ETH
    receive() external payable {}

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    	 OPERATOR FILTER                      */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

	function transferFrom(address from, address to, uint256 tokenId)
        public
        payable
        override(IERC721A, ERC721A)
        onlyAllowedOperator(from)
    {
        super.transferFrom(from, to, tokenId);
    }

    function setOperatorFilteringEnabled(bool value) public onlyOwner {
        operatorFilteringEnabled = value;
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return operatorFilteringEnabled;
    }
	
    /// @dev For deriving contracts to override, so that preferred marketplaces can
    /// skip operator filtering, helping users save gas.
    /// Returns false for all inputs by default.
    function _isPriorityOperator(address operator) internal pure override returns (bool) {
        return operator == address(0x1E0049783F008A0085193E00003D00cd54003c71);
    }
	
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    	     ROYALTIES                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(IERC721A, ERC721A, ERC2981)
        returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

}
