require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');

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
            url: process.env.INFURA_SEPOLIA_URL,
            accounts: [process.env.PRIVATE_KEY],
        },
        goerli: {
            url: process.env.INFURA_GOERLI_URL,
            accounts: [process.env.PRIVATE_KEY],
            gas: 3e7,
        },
        mainnet: {
            url: process.env.ALCHEMY_MAINNET_URL,
            accounts: [process.env.PRIVATE_KEY],
        },
        polygon: {
            url: process.env.ALCHEMY_POLYGON_URL,
            accounts: [process.env.PRIVATE_KEY_POLYGON],
        },
    },
    etherscan: {
        // apiKey: process.env.ETHERSCAN_KEY,
        apiKey: process.env.POLYGONSCAN_KEY,
    },
    gasReporter: {
        enabled: true,
        currency: 'USD',
        coinmarketcap: process.env.COINMARKETCAP_KEY,
    },
};
