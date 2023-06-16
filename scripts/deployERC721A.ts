const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const factory = await hre.ethers.getContractFactory('ExampleERC721A');
    const contract = await factory.deploy(owner.address);
    await contract.deployed();

    await contract.connect(owner).toggleIsPublicMintOpen();

    console.log(`✅ Contract deployed to address: ${contract.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
