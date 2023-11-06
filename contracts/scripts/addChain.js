const { ethers, network } = require("hardhat")

async function addChain() {
    if (network.config.chainId != 5) {
        console.log("Cross chain function cannot be called on this chain")
    } else {
        const senderUNO = await ethers.getContractAt(
            "OxSenderUNO",
            "0xF1D62f668340323a6533307Bb0e44600783BE5CA"
        )
        await senderUNO.addChain(
            "9991",
            "0x1e0Db00EB08ceC7FFdA03c0Dbf224193E1563844",
            "0x878E67CAdEa753E407c812c76A15402912003e45"
        )
        console.log("Added the chain!")
    }
}

addChain()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
