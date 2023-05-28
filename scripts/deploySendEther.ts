const hre = require('hardhat');

const networkName = process.env.HARDHAT_NETWORK
    ? process.env.HARDHAT_NETWORK
    : 'hardhat local';
const contractName = 'SendEther';

async function main() {
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy();
    await contract.deployed();

    console.log(
        `✅ Contract ${contractName} deployed to address: ${contract.address}`
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
