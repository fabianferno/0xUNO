const { network, ethers } = require("hardhat")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let args = []
    if (chainId != 5) {
        // Deplying the main OxUNO contract
        args = ["5"]
        const receiverUNO = await deploy("OxReceiverUNO", {
            from: deployer,
            args,
            log: true,
            waitBlockConfirmations: 5,
        })
        await verify(receiverUNO.address, args)
    } else {
        // Deploying the cross-chain OxUNO contract on Goerli which can play in Mumbai with GoerliETH
        args = [
            "0xFCa08024A6D4bCc87275b1E4A1E22B71fAD7f649",
            "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
        ]
        const senderUNO = await deploy("OxSenderUNO", {
            from: deployer,
            args,
            log: true,
            waitBlockConfirmations: 5,
        })
        await verify(senderUNO.address, args)
    }
}
