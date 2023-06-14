import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
// import { ethers } from 'hardhat';
const { ethers } = require('hardhat');
import { Contract, Signer } from 'ethers';
import { formatEther, formatBytes32String } from 'ethers/lib/utils';
import { computeMerkleRoot, computeMerkleProof } from '../utils/merkleTree';

async function initializeTests() {
    const contractName = 'ExampleERC721A';

    const [owner, addr1, addr2] = await ethers.getSigners();
    const treasuryWallet = owner.address;
    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy(treasuryWallet);

    const allowlist = [owner.address, addr1.address, '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'];
    const merkleRoot = computeMerkleRoot(allowlist);

    await contract.connect(owner).setMerkleRoot(merkleRoot);

    return { contract, owner, addr1, addr2, allowlist, merkleRoot, treasuryWallet };
}

describe('ExampleERC721A tests', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    let contract: Contract;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let allowlist: string[];
    let merkleRoot: string;
    let treasuryWallet: string;

    const expected = {
        tokenName: 'ExampleERC721A',
        tokenSymbol: 'Example',
        maxSupply: 10000,
        publicMintPrice: ethers.utils.parseEther('1'),
        allowlistMintPrice: ethers.utils.parseEther('0.5'),
        maxPublicMintsPerTxn: 5,
        maxAllowlistMintsPerTxn: 2,
        defaultRoyaltyBips: 500,
        isOperatorFilteringEnabled: true,
        defaultIsPublicMintOpen: false,
        defaultIsAllowlistMintOpen: false,
        // allowlist: [owner.address, addr1.address, '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'],
        // merkleRoot: computeMerkleRoot([owner.address, addr1.address, '0xd8da6bf26964af9d7eed9e03e53415d37aa96045']),
    };

    beforeEach(async function () {
        const fixture = await loadFixture(initializeTests);
        contract = fixture.contract;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        allowlist = fixture.allowlist;
        merkleRoot = fixture.merkleRoot;
    });

    describe('default storage values', function () {
        it('should have the correct name', async function () {
            expect(await contract.name()).to.equal(expected.tokenName);
        });
        it('should have the correct symbol', async function () {
            expect(await contract.symbol()).to.equal(expected.tokenSymbol);
        });
        it('should have the correct max supply', async function () {
            expect(await contract.maxSupply()).to.equal(expected.maxSupply);
        });
        it('should have the correct max per transaction', async function () {
            expect(await contract.maxPublicMintsPerTxn()).to.equal(expected.maxPublicMintsPerTxn);
            expect(await contract.maxAllowlistMintsPerTxn()).to.equal(expected.maxAllowlistMintsPerTxn);
        });
        it('should have the correct public mint price', async function () {
            expect(await contract.publicMintPrice()).to.equal(expected.publicMintPrice);
        });
        it('should have the correct allowlist mint price', async function () {
            expect(await contract.allowlistMintPrice()).to.equal(expected.allowlistMintPrice);
        });
    });

    describe('mintPublic', function () {
        it('should update minters balance after minting successfully', async function () {
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            await contract.connect(owner).toggleIsPublicMintOpen();
            await contract.connect(addr1).mintPublic(1, { value: expected.publicMintPrice });
            expect(await contract.balanceOf(addr1.address)).to.equal(1);
        });
        it('should mint when minter pays correct amount and mint is open', async function () {
            await contract.connect(owner).toggleIsPublicMintOpen();
            expect(await contract.connect(addr1).mintPublic(1, { value: expected.publicMintPrice })).to.be.ok;
        });
        it('should mint any amount up to the maximum per transaction limit', async function () {
            await contract.connect(owner).toggleIsPublicMintOpen();
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            expect(
                await contract.connect(addr1).mintPublic(expected.maxPublicMintsPerTxn, {
                    value: expected.publicMintPrice.mul(expected.maxPublicMintsPerTxn),
                })
            ).to.be.ok;
            expect(await contract.balanceOf(addr1.address)).to.equal(expected.maxPublicMintsPerTxn);
        });
        it('should revert when minter pays incorrect amount', async function () {
            await contract.connect(owner).toggleIsPublicMintOpen();
            await expect(contract.connect(addr1).mintPublic(1, { value: '0' })).to.be.revertedWithCustomError(
                contract,
                'IncorrectPayment'
            );
            await expect(
                contract.connect(addr1).mintPublic(1, { value: expected.publicMintPrice.mul(10) })
            ).to.be.revertedWithCustomError(contract, 'IncorrectPayment');
        });
        it('should revert when mint is not open', async function () {
            await expect(contract.connect(addr1).mintPublic(1, { value: '0' })).to.be.revertedWithCustomError(
                contract,
                'MintNotOpen'
            );
        });
        it('should revert when minting more than maximum per transaction', async function () {
            await contract.connect(owner).toggleIsPublicMintOpen();
            await expect(
                contract.connect(addr1).mintPublic(50, { value: expected.publicMintPrice.mul(50) })
            ).to.be.revertedWithCustomError(contract, 'ExceedsTxnLimit');
        });
        it('should revert if minting over max supply', async function () {
            await contract.connect(owner).toggleIsPublicMintOpen();
            await contract.connect(owner).mintReserve(expected.maxSupply);
            await expect(
                contract.connect(addr1).mintPublic(1, { value: expected.publicMintPrice })
            ).to.be.revertedWithCustomError(contract, 'ExceedsMaxSupply');
            await expect(
                contract.connect(owner).mintPublic(2, { value: expected.publicMintPrice.mul(2) })
            ).to.be.revertedWithCustomError(contract, 'ExceedsMaxSupply');
        });
    });
    describe('mintAllowlist', function () {
        it('should update minters balance after minting successfully', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await contract.connect(addr1).mintAllowlist(1, merkleProof, { value: expected.allowlistMintPrice });
            expect(await contract.balanceOf(addr1.address)).to.equal(1);
        });
        it('should mint when minter pays correct amount and mint is open', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);

            await contract.connect(owner).toggleIsAllowlistMintOpen();
            expect(await contract.connect(addr1).mintAllowlist(1, merkleProof, { value: expected.allowlistMintPrice }))
                .to.be.ok;
        });
        it('should mint any amount up to the maximum per transaction limit', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);

            await contract.connect(owner).toggleIsAllowlistMintOpen();
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            expect(
                await contract.connect(addr1).mintAllowlist(expected.maxAllowlistMintsPerTxn, merkleProof, {
                    value: expected.allowlistMintPrice.mul(expected.maxAllowlistMintsPerTxn),
                })
            ).to.be.ok;
            expect(await contract.balanceOf(addr1.address)).to.equal(expected.maxAllowlistMintsPerTxn);
        });
        it('should revert when minter pays incorrect amount', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);

            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await expect(
                contract.connect(addr1).mintAllowlist(1, merkleProof, { value: '0' })
            ).to.be.revertedWithCustomError(contract, 'IncorrectPayment');
            await expect(
                contract.connect(addr1).mintAllowlist(1, merkleProof, { value: expected.allowlistMintPrice.mul(10) })
            ).to.be.revertedWithCustomError(contract, 'IncorrectPayment');
        });
        it('should revert when mint is not open', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);
            await expect(
                contract.connect(addr1).mintAllowlist(1, merkleProof, { value: '0' })
            ).to.be.revertedWithCustomError(contract, 'MintNotOpen');
        });
        it('should revert when minting more than maximum per transaction', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await expect(
                contract.connect(addr1).mintAllowlist(50, merkleProof, { value: expected.allowlistMintPrice.mul(50) })
            ).to.be.revertedWithCustomError(contract, 'ExceedsTxnLimit');
        });
        it('should revert if minting over max supply', async function () {
            const merkleProof = computeMerkleProof(allowlist, addr1.address);
            const merkleProofOwner = computeMerkleProof(allowlist, owner.address);
            await contract.connect(owner).toggleIsAllowlistMintOpen();

            await contract.connect(owner).mintReserve(expected.maxSupply);
            await expect(
                contract.connect(addr1).mintAllowlist(1, merkleProof, { value: expected.allowlistMintPrice })
            ).to.be.revertedWithCustomError(contract, 'ExceedsMaxSupply');
            await expect(
                contract.connect(owner).mintAllowlist(2, merkleProof, { value: expected.allowlistMintPrice.mul(2) })
            ).to.be.revertedWithCustomError(contract, 'ExceedsMaxSupply');
        });
    });
    describe('mintReserve', function () {
        it('should update minters balance after minting successfully', async function () {
            expect(await contract.balanceOf(owner.address)).to.equal(0);
            await contract.connect(owner).mintReserve(1);
            expect(await contract.balanceOf(owner.address)).to.equal(1);
            await contract.connect(owner).mintReserve(100);
            expect(await contract.balanceOf(owner.address)).to.equal(101);
        });
        it('should revert if minting over max supply', async function () {
            await contract.connect(owner).mintReserve(expected.maxSupply);
            await expect(contract.connect(owner).mintReserve(1)).to.be.revertedWithCustomError(
                contract,
                'ExceedsMaxSupply'
            );
        });
    });
    context('Setter functions', function () {
        describe('setMaxSupply', function () {
            it('should update max supply', async function () {
                expect(await contract.maxSupply()).to.equal(expected.maxSupply);
                await contract.connect(owner).setMaxSupply(100);
                expect(await contract.maxSupply()).to.equal(100);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).setMaxSupply(100)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setMaxPublicMints', function () {
            it('should update max public mints', async function () {
                expect(await contract.maxPublicMintsPerTxn()).to.equal(expected.maxPublicMintsPerTxn);
                await contract.connect(owner).setMaxPublicMints(10);
                expect(await contract.maxPublicMintsPerTxn()).to.equal(10);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).setMaxPublicMints(10)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setMaxAllowlistMints', function () {
            it('should update max allowlist mints', async function () {
                expect(await contract.maxAllowlistMintsPerTxn()).to.equal(expected.maxAllowlistMintsPerTxn);
                await contract.connect(owner).setMaxAllowlistMints(10);
                expect(await contract.maxAllowlistMintsPerTxn()).to.equal(10);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).setMaxAllowlistMints(10)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setPublicMintPrice', function () {
            it('should update public mint price', async function () {
                expect(await contract.publicMintPrice()).to.equal(expected.publicMintPrice);
                await contract.connect(owner).setPublicMintPrice(ethers.utils.parseEther('2'));
                expect(await contract.publicMintPrice()).to.equal(ethers.utils.parseEther('2'));
            });
            it('should revert when not called by owner', async function () {
                await expect(
                    contract.connect(addr1).setPublicMintPrice(ethers.utils.parseEther('2'))
                ).to.be.revertedWith('Ownable: caller is not the owner');
            });
        });
        describe('setAllowlistMintPrice', function () {
            it('should update allowlist mint price', async function () {
                expect(await contract.allowlistMintPrice()).to.equal(expected.allowlistMintPrice);
                await contract.connect(owner).setAllowlistMintPrice(ethers.utils.parseEther('2'));
                expect(await contract.allowlistMintPrice()).to.equal(ethers.utils.parseEther('2'));
            });
            it('should revert when not called by owner', async function () {
                await expect(
                    contract.connect(addr1).setAllowlistMintPrice(ethers.utils.parseEther('2'))
                ).to.be.revertedWith('Ownable: caller is not the owner');
            });
        });
        describe('setMerkleRoot', function () {
            it('should update merkle root', async function () {
                expect(await contract.merkleRoot()).to.equal(merkleRoot);
                const newMerkleRoot = formatBytes32String('newMerkleRoot');
                await contract.connect(owner).setMerkleRoot(newMerkleRoot);
                expect(await contract.merkleRoot()).to.equal(newMerkleRoot);
            });
            it('should revert when not called by owner', async function () {
                const newMerkleRoot = formatBytes32String('newMerkleRoot');

                await expect(contract.connect(addr1).setMerkleRoot(newMerkleRoot)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setBaseURI', function () {
            it('should update base URI', async function () {
                await contract.connect(owner).toggleIsPublicMintOpen();
                await contract.connect(addr1).mintPublic(expected.maxPublicMintsPerTxn, {
                    value: expected.publicMintPrice.mul(expected.maxPublicMintsPerTxn),
                });
                const newBaseURI = 'https://example.com/';
                await contract.connect(owner).setBaseURI(newBaseURI);
                expect(await contract.tokenURI(0)).to.equal(newBaseURI + '0');
                expect(await contract.tokenURI(1)).to.equal(newBaseURI + '1');
                expect(await contract.tokenURI(2)).to.equal(newBaseURI + '2');
            });
            it('should revert when not called by owner', async function () {
                const newBaseURI = 'https://example.com/';

                await expect(contract.connect(addr1).setBaseURI(newBaseURI)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setDefaultRoyalty', function () {
            it('should update royalty percentage', async function () {
                const tokenId = 1;
                const salePrice = ethers.utils.parseEther('1');
                const expectedOldRoyaltyAmount = salePrice.mul(expected.defaultRoyaltyBips).div(10000);
                const [, oldRoyaltyAmount] = await contract.royaltyInfo(tokenId, salePrice);
                expect(oldRoyaltyAmount).to.equal(expectedOldRoyaltyAmount);

                const newRoyaltyBips = 1000;
                const expectedRoyaltyAmount = salePrice.mul(newRoyaltyBips).div(10000);
                await contract.connect(owner).setDefaultRoyalty(addr2.address, newRoyaltyBips);

                const [, royaltyAmount] = await contract.royaltyInfo(tokenId, salePrice);
                expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
            });
            it('should update royalty receiver', async function () {
                const tokenId = 1;
                const salePrice = ethers.utils.parseEther('1');
                const [initialRoyaltyReceiver] = await contract.royaltyInfo(tokenId, salePrice);
                expect(initialRoyaltyReceiver).to.equal(owner.address);

                const newRoyaltyReceiver = addr2.address;
                await contract.connect(owner).setDefaultRoyalty(newRoyaltyReceiver, expected.defaultRoyaltyBips);

                const [royaltyReceiver] = await contract.royaltyInfo(tokenId, salePrice);
                expect(royaltyReceiver).to.equal(newRoyaltyReceiver);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).setDefaultRoyalty(addr1.address, 1000)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('setOperatorFilteringEnabled', function () {
            it('should update operator filtering', async function () {
                expect(await contract.operatorFilteringEnabled()).to.equal(expected.isOperatorFilteringEnabled);
                await contract.connect(owner).setOperatorFilteringEnabled(false);
                expect(await contract.operatorFilteringEnabled()).to.equal(false);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).setOperatorFilteringEnabled(false)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('toggleIsPublicMintOpen', function () {
            it('should update public mint status', async function () {
                expect(await contract.isPublicMintOpen()).to.equal(expected.defaultIsPublicMintOpen);
                await contract.connect(owner).toggleIsPublicMintOpen();
                expect(await contract.isPublicMintOpen()).to.equal(true);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).toggleIsPublicMintOpen()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
        describe('toggleIsAllowlistMintOpen', function () {
            it('should update allowlist mint status', async function () {
                expect(await contract.isAllowlistMintOpen()).to.equal(expected.defaultIsAllowlistMintOpen);
                await contract.connect(owner).toggleIsAllowlistMintOpen();
                expect(await contract.isAllowlistMintOpen()).to.equal(true);
            });
            it('should revert when not called by owner', async function () {
                await expect(contract.connect(addr1).toggleIsAllowlistMintOpen()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });
        });
    });

    describe('Withdraw funds', function () {
        it('should withdraw funds to treasury wallet', async function () {
            // Recipient in this case is the contract owner.
            const initialTreasuryBalance = await owner.getBalance();
            await contract.connect(owner).toggleIsPublicMintOpen();
            await contract.connect(addr1).mintPublic(1, { value: expected.publicMintPrice });
            await contract.connect(owner).withdrawAll();
            const finalTreasuryBalance = await owner.getBalance();

            expect(finalTreasuryBalance).to.be.gt(initialTreasuryBalance);
        });
        it('should revert if contract has empty balance', async function () {
            await expect(contract.connect(owner).withdrawAll()).to.be.revertedWithCustomError(
                contract,
                'NoFundsToWithdraw'
            );
        });
        it('should revert when not called by owner', async function () {
            await expect(contract.connect(addr1).withdrawAll()).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
    describe('supportsInterface', function () {
        it('should return true for ERC721 interface', async function () {
            expect(await contract.supportsInterface('0x80ac58cd')).to.equal(true);
        });

        it('should return true for ERC165 interface', async function () {
            expect(await contract.supportsInterface('0x01ffc9a7')).to.equal(true);
        });
    });
});
