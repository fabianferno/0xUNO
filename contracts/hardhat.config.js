require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const SCROLL_RPC_URL = process.env.SCROLL_RPC_URL
const TAIKO_RPC_URL = process.env.TAIKO_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY
// Your API key for Etherscan, obtain one at https://etherscan.io/
const REPORT_GAS = process.env.REPORT_GAS || false

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        goerli: {
            url: "https://rpc.ankr.com/eth_goerli",
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 5,
        },
        polygonMumbai: {
            url: "https://rpc.ankr.com/polygon_mumbai",
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 80001,
        },
        scroll: {
            url: SCROLL_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 534353,
        },
        taiko: {
            url: TAIKO_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 167004,
        },
        chiado: {
            url: "https://rpc.chiadochain.net",
            gasPrice: 1000000000,
            saveDeployments: true,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 10200,
        },
        gnosis: {
            url: "https://gnosis.blockpi.network/v1/rpc/public",
            gasPrice: 2000000000,
            saveDeployments: true,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 100,
        },
    },
    etherscan: {
        // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
            chiado: ETHERSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
            scroll: ETHERSCAN_API_KEY,
            taiko: ETHERSCAN_API_KEY,
            gnosis: "6X39Z4P31C9TJ21A769UAYGCF9NPB648RC",
        },
        customChains: [
            {
                network: "scroll",
                chainId: 534353,
                urls: {
                    apiURL: "https://blockscout.scroll.io/api",
                    browserURL: "https://blockscout.scroll.io/",
                },
            },
            {
                network: "taiko",
                chainId: 167004,
                urls: {
                    apiURL: "https://explorer.a2.taiko.xyz/api",
                    browserURL: "https://explorer.a2.taiko.xyz/",
                },
            },
            {
                network: "chiado",
                chainId: 10200,
                urls: {
                    apiURL: "https://blockscout.chiadochain.net/api",
                    browserURL: "https://blockscout.chiadochain.net/",
                },
            },
        ],
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    contractSizer: {
        runOnCompile: false,
        only: ["EntryPoint"],
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                },
            },
        ],
    },
    allowUnlimitedContractSize: true,
    mocha: {
        timeout: 500000, // 500 seconds max for running tests
    },
}
