// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721A, ERC721A } from 'erc721a/contracts/ERC721A.sol';
import { ERC721AQueryable } from 'erc721a/contracts/extensions/ERC721AQueryable.sol';
import { ERC2981 } from 'solady/src/tokens/ERC2981.sol';
import { Ownable } from 'solady/src/auth/Ownable.sol';
import { MerkleProofLib } from 'solady/src/utils/MerkleProofLib.sol';
import { OperatorFilterer } from 'closedsea/src/OperatorFilterer.sol';

contract DutchAuctionDrop is ERC721AQueryable, Ownable, OperatorFilterer, ERC2981 {
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           ERRORS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    error CallerIsContract();
    error ExceedsTxnLimit();
    error ExceedsMaxSupply();
    error IncorrectPayment();
    error NoFundsToWithdraw();
    error NotOnAllowlist();
    error MintNotStarted();
    error TransferFailed();

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           STORAGE                          */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    address public immutable TREASURY;
    uint256 public maxSupply = 10000;
    uint256 public maxPublicMintsPerTxn = 5;
    uint256 public maxAllowlistMintsPerTxn = 2;
    uint256 public publicMintPrice = 1 ether;
    uint256 public allowlistMintPrice = 0.5 ether;
    bool public isPublicMintOpen;
    bool public isAllowlistMintOpen;
    bool public operatorFilteringEnabled;
    string public baseTokenURI;
    bytes32 public merkleRoot;
    address private _offchainSigner;

    uint256 public clearingPrice;
    struct BidParams {
        uint8 numMinted;
        uint64 amountPaid;
        uint64 amountRefunded;
    }

    mapping(address => BidParams) public refundMapping;

    struct AuctionParams {
        uint64 startPrice;
        uint64 endPrice;
        uint64 priceDecreasePerInterval; // Price reduction per drop
        uint32 startTime;
        uint32 priceDecreaseTimeInterval; // Time in seconds between price drops
    }
    AuctionParams public auctionParams;

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          MODIFIERS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Requires that the minter is not a contract, and mint amount does not exceed maximum supply
    modifier validTxn(uint256 nMints) {
        if (msg.sender != tx.origin) revert CallerIsContract();
        if (totalSupply() + nMints > maxSupply) revert ExceedsMaxSupply();
        _;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         CONSTRUCTOR                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    constructor(address _treasury) ERC721A('ExampleERC721A', 'Example') {
        TREASURY = _treasury;
        operatorFilteringEnabled = true;
        _registerForOperatorFiltering();
        _initializeOwner(msg.sender);
        _setDefaultRoyalty(msg.sender, 500);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        MINT FUNCTIONS                      */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function mintDutchAuction(uint256 numMints) external payable validTxn(numMints) {
        uint256 currentPrice = getAuctionPrice();
        uint256 totalPrice = currentPrice * numMints;
        if (msg.value < totalPrice) revert IncorrectPayment();
        if (block.timestamp < auctionParams.startTime) revert MintNotStarted();
        if (totalSupply() + numMints > maxSupply) revert ExceedsMaxSupply();

        // Update user's refund info if minted multiple times
        BidParams memory userRefund = refundMapping[msg.sender];
        userRefund.numMinted += uint8(numMints);
        userRefund.amountPaid += uint64(msg.value);
        refundMapping[msg.sender] = userRefund;

        // If auction hits max supply, set clearing price
        if (totalSupply() + numMints == maxSupply) clearingPrice = currentPrice;

        _mint(msg.sender, numMints);
    }

    function getAuctionPrice() public view returns (uint256) {
        if (block.timestamp < auctionParams.startTime) revert MintNotStarted();

        AuctionParams memory _auctionParams = auctionParams;

        uint256 timeElapsed = block.timestamp - _auctionParams.startTime;
        uint256 numSteps = timeElapsed / _auctionParams.priceDecreaseTimeInterval;
        uint256 priceDecrease = numSteps * _auctionParams.priceDecreasePerInterval;
        if (priceDecrease > _auctionParams.startPrice - _auctionParams.endPrice) {
            return _auctionParams.endPrice;
        }
        return _auctionParams.startPrice - priceDecrease;
    }

    function getRefundAmount(address user) public view returns (uint256) {
        BidParams memory userRefund = refundMapping[user];
        if (userRefund.amountPaid == 0) return 0;
        if (userRefund.numMinted == 0) return 0;

        uint256 refundAmount = userRefund.amountPaid - (userRefund.numMinted * clearingPrice) - userRefund.amountRefunded;
        return refundAmount;
    }

    function claimRefund() external {
        BidParams memory userRefund = refundMapping[msg.sender];
        if (userRefund.amountRefunded > 0) revert('Already refunded');
        if (userRefund.amountPaid == 0) revert('No refund available');
        if (userRefund.numMinted == 0) revert('No refund available');

        uint256 refundAmount = userRefund.amountPaid - (userRefund.numMinted * clearingPrice);
    }

    /// @notice Allowlist mint when allowlist sale is open
    /// @dev Uses a Merkle tree to verify if address is on allowlist
    function mintAllowlist(uint256 nMints, bytes32[] calldata _proof) external payable validTxn(nMints) {
        bytes32 node = keccak256(abi.encodePacked(msg.sender));
        if (!isAllowlistMintOpen) revert MintNotStarted();
        if (!MerkleProofLib.verifyCalldata(_proof, merkleRoot, node)) revert NotOnAllowlist();
        if (msg.value != allowlistMintPrice * nMints) revert IncorrectPayment();
        if (_numberMinted(msg.sender) + nMints > maxAllowlistMintsPerTxn) revert ExceedsTxnLimit();

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
    function setAuctionParams(
        uint64 _startPrice,
        uint64 _endPrice,
        uint64 _priceDecreasePerInterval,
        uint32 _startTime,
        uint32 _priceDecreaseTimeInterval
    ) external onlyOwner {
        auctionParams = AuctionParams(_startPrice, _endPrice, _priceDecreasePerInterval, _startTime, _priceDecreaseTimeInterval);
    }

    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        maxSupply = _maxSupply;
    }

    function setMaxPublicMints(uint256 _maxPublicMintsPerTxn) external onlyOwner {
        maxPublicMintsPerTxn = _maxPublicMintsPerTxn;
    }

    function setMaxAllowlistMints(uint256 _maxAllowlistMintsPerTxn) external onlyOwner {
        maxAllowlistMintsPerTxn = _maxAllowlistMintsPerTxn;
    }

    function setPublicMintPrice(uint256 _publicMintPrice) external onlyOwner {
        publicMintPrice = _publicMintPrice;
    }

    function setAllowlistMintPrice(uint256 _allowlistMintPrice) external onlyOwner {
        allowlistMintPrice = _allowlistMintPrice;
    }

    /// @notice Allows the owner to update the allowlist Merkle root hash
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    /// @notice Allows the owner to set the base URI
    function setBaseURI(string calldata _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setOperatorFilteringEnabled(bool value) public onlyOwner {
        operatorFilteringEnabled = value;
    }

    /// @notice Allows the owner to flip the public mint state
    function toggleIsPublicMintOpen() external onlyOwner {
        isPublicMintOpen = !isPublicMintOpen;
    }

    /// @notice Allows the owner to flip the allowlist sale state
    function toggleIsAllowlistMintOpen() external onlyOwner {
        isAllowlistMintOpen = !isAllowlistMintOpen;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                      HELPERS AND OVERRIDES                 */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Allows contract to transfer and amount of funds to an address
    function _withdraw(address _address, uint256 _amount) private {
        (bool success, ) = payable(_address).call{ value: _amount }('');
        if (!success) revert TransferFailed();
    }

    /// @notice Allows the owner to withdraw and split contract funds
    function withdrawAll() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        if (contractBalance == 0) revert NoFundsToWithdraw();
        _withdraw(TREASURY, address(this).balance);
    }

    /// @notice Override view function to get the base URI from storage
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    /// @dev Allows contract to receive ETH
    receive() external payable {}

    function transferFrom(address from, address to, uint256 tokenId) public payable override(IERC721A, ERC721A) onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return operatorFilteringEnabled;
    }

    /// @dev Helper function to save gas when trading via Seaport Conduit
    function _isPriorityOperator(address operator) internal pure override returns (bool) {
        return operator == address(0x1E0049783F008A0085193E00003D00cd54003c71);
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC721A, ERC721A, ERC2981) returns (bool) {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
