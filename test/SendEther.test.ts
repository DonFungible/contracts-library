import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Lock', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContract() {
        const [owner, otherAccount] = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory('SendEther');
        const contract = await contractFactory.deploy();

        return { contract, owner, otherAccount };
    }

    describe('Deployment', function () {
        it('Should be able to send ether', async function () {
            const { contract, owner, otherAccount } = await deployContract();
            await contract.connect(owner).sendEther(otherAccount.address, {
                value: '1000000000',
            });
        });
    });
});
