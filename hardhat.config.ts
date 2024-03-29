require('@nomicfoundation/hardhat-toolbox');

// require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

require('hardhat-gas-reporter');
require('solidity-coverage');
require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
    solidity: {
        version: '0.8.19',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000,
            },
        },
    },
    networks: {
        hardhat: {
            blockGasLimit: 90001280408,
            gas: 90001280408,
        },
        sepolia: {
            url: 'https://eth-sepolia.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY || process.env.INFURA_API_KEY,
            accounts: [process.env.PRIVATE_KEY],
        },
        goerli: {
            url: 'https://eth-goerli.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY || process.env.INFURA_API_KEY,
            accounts: [process.env.PRIVATE_KEY],
            gas: 3e7,
        },
        mainnet: {
            url: 'https://eth-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY || process.env.INFURA_API_KEY,
            accounts: [process.env.PRIVATE_KEY],
        },
        polygon: {
            url:
                'https://polygon-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY || process.env.INFURA_API_KEY,
            accounts: [process.env.PRIVATE_KEY],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY,
        // apiKey: process.env.POLYGONSCAN_KEY,
    },
    gasReporter: {
        enabled: true,
        currency: 'USD',
        coinmarketcap: process.env.COINMARKETCAP_KEY,
    },
};
