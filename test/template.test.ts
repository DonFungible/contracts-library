import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

async function deployContract() {
    const contractName = 'Template';
    const [owner, addr1, addr2] = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy();

    return { contract, owner, addr1, addr2 };
}

describe('Template tests', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    let contract;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        const fixture = await loadFixture(deployContract);
        contract = fixture.contract;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
    });

    describe('Deployment', function () {
        it('Should be able to send ether', async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
        });
    });
});
