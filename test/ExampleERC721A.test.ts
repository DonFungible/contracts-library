import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
// import { ethers } from 'hardhat';
const { ethers } = require('hardhat');
import { Contract, Signer } from 'ethers';
import { formatEther } from 'ethers/lib/utils';

async function deployContract() {
    const contractName = 'ExampleERC721A';
    const [owner, addr1, addr2] = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy();

    return { contract, owner, addr1, addr2 };
}

describe('ExampleERC721A tests', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    let contract: Contract;
    let owner: any;
    let addr1: any;
    let addr2: any;

    const expected = {
        tokenName: 'ExampleERC721A',
        tokenSymbol: 'Example',
        maxSupply: 10000,
        publicMintPrice: ethers.utils.parseEther('1'),
        allowlistMintPrice: ethers.utils.parseEther('0.5'),
        maxPublicMintPerTxn: 5,
        maxAllowlistMintPerTxn: 2,
    };

    beforeEach(async function () {
        const fixture = await loadFixture(deployContract);
        contract = fixture.contract;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
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
            expect(await contract.maxPublicMintsPerTxn()).to.equal(expected.maxPublicMintPerTxn);
            expect(await contract.maxAllowlistMintsPerTxn()).to.equal(expected.maxAllowlistMintPerTxn);
        });
        it('should have the correct public mint price', async function () {
            expect(await contract.publicMintPrice()).to.equal(expected.publicMintPrice);
        });
        it('should have the correct allowlist mint price', async function () {
            expect(await contract.allowlistMintPrice()).to.equal(expected.allowlistMintPrice);
        });
    });

    describe('mintPublic', function () {
        it('should update minters balance after minting', async function () {
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
                await contract.connect(addr1).mintPublic(expected.maxPublicMintPerTxn, {
                    value: expected.publicMintPrice.mul(expected.maxPublicMintPerTxn),
                })
            ).to.be.ok;
            expect(await contract.balanceOf(addr1.address)).to.equal(expected.maxPublicMintPerTxn);
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
    });
    describe('mintAllowlist', function () {
        it('should update minters balance after minting', async function () {
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await contract.connect(addr1).mintAllowlist(1, { value: expected.publicMintPrice });
            expect(await contract.balanceOf(addr1.address)).to.equal(1);
        });
        it('should mint when minter pays correct amount and mint is open', async function () {
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            expect(await contract.connect(addr1).mintAllowlist(1, { value: expected.publicMintPrice })).to.be.ok;
        });
        it('should mint any amount up to the maximum per transaction limit', async function () {
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            expect(await contract.balanceOf(addr1.address)).to.equal(0);
            expect(
                await contract.connect(addr1).mintAllowlist(expected.maxPublicMintPerTxn, {
                    value: expected.publicMintPrice.mul(expected.maxPublicMintPerTxn),
                })
            ).to.be.ok;
            expect(await contract.balanceOf(addr1.address)).to.equal(expected.maxPublicMintPerTxn);
        });
        it('should revert when minter pays incorrect amount', async function () {
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await expect(contract.connect(addr1).mintAllowlist(1, { value: '0' })).to.be.revertedWithCustomError(
                contract,
                'IncorrectPayment'
            );
            await expect(
                contract.connect(addr1).mintAllowlist(1, { value: expected.publicMintPrice.mul(10) })
            ).to.be.revertedWithCustomError(contract, 'IncorrectPayment');
        });
        it('should revert when mint is not open', async function () {
            await expect(contract.connect(addr1).mintAllowlist(1, { value: '0' })).to.be.revertedWithCustomError(
                contract,
                'MintNotOpen'
            );
        });
        it('should revert when minting more than maximum per transaction', async function () {
            await contract.connect(owner).toggleIsAllowlistMintOpen();
            await expect(
                contract.connect(addr1).mintAllowlist(50, { value: expected.publicMintPrice.mul(50) })
            ).to.be.revertedWithCustomError(contract, 'ExceedsTxnLimit');
        });
    });
});
