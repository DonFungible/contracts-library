const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const factory = await hre.ethers.getContractFactory('ExampleERC721A');
    const contract = await factory.deploy(owner.address);
    await contract.deployed();

    await contract.connect(owner).toggleIsPublicMintOpen();

    console.log(`✅ Contract deployed to address: ${contract.address}`);
    console.log(`👑 Owner address: ${owner.address}`);

    await contract.connect(owner).mintReserve(1);
    await contract.connect(owner).setBaseURI('https://erc6551-token-overlay.vercel.app/');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
