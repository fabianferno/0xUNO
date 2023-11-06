// from: https://github.com/Arachnid/deterministic-deployment-proxy
const { BigNumber, BigNumberish, ethers, Signer } = require("ethers")
const { Provider } = require("@ethersproject/providers")
const { TransactionRequest } = require("@ethersproject/abstract-provider")

class Create2Factory {
    factoryDeployed = false

    static contractAddress = "0x4e59b44847b379578588920ca78fbf26c0b4956c"
    static factoryTx =
        "0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222"
    static factoryDeployer = "0x3fab184622dc19b6109349b94811493bf2a45362"
    static deploymentGasPrice = 100e9
    static deploymentGasLimit = 100000
    static factoryDeploymentFee = (
        Create2Factory.deploymentGasPrice * Create2Factory.deploymentGasLimit
    ).toString()

    constructor(provider, signer = provider.getSigner()) {}

    /**
     * deploy a contract using our deterministic deployer.
     * The deployer is deployed (unless it is already deployed)
     * NOTE: this transaction will fail if already deployed. use getDeployedAddress to check it first.
     * @param initCode delpoyment code. can be a hex string or factory.getDeploymentTransaction(..)
     * @param salt specific salt for deployment
     * @param gasLimit gas limit or 'estimate' to use estimateGas. by default, calculate gas based on data size.
     */
    async deploy(initCode, salt = 0, gasLimit) {
        await this.deployFactory()
        if (typeof initCode !== "string") {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            initCode = initCode.data.toString()
        }

        const addr = Create2Factory.getDeployedAddress(initCode, salt)
        if ((await this.provider.getCode(addr).then((code) => code.length)) > 2) {
            return addr
        }

        const deployTx = {
            to: Create2Factory.contractAddress,
            data: this.getDeployTransactionCallData(initCode, salt),
        }
        if (gasLimit === "estimate") {
            gasLimit = await this.signer.estimateGas(deployTx)
        }

        // manual estimation (its bit larger: we don't know actual deployed code size)
        if (gasLimit === undefined) {
            gasLimit =
                ethers.utils
                    .arrayify(initCode)
                    .map((x) => (x === 0 ? 4 : 16))
                    .reduce((sum, x) => sum + x) +
                (200 * initCode.length) / 2 + // actual is usually somewhat smaller (only deposited code, not entire constructor)
                6 * Math.ceil(initCode.length / 64) + // hash price. very minor compared to deposit costs
                32000 +
                21000

            // deployer requires some extra gas
            gasLimit = Math.floor((gasLimit * 64) / 63)
        }

        const ret = await this.signer.sendTransaction({ ...deployTx, gasLimit })
        await ret.wait()
        if ((await this.provider.getCode(addr).then((code) => code.length)) === 2) {
            throw new Error("failed to deploy")
        }
        return addr
    }

    getDeployTransactionCallData(initCode, salt = 0) {
        const saltBytes32 = ethers.utils.hexZeroPad(ethers.utils.hexlify(salt), 32)
        return ethers.utils.hexConcat([saltBytes32, initCode])
    }

    /**
     * return the deployed address of this code.
     * (the deployed address to be used by deploy()
     * @param initCode
     * @param salt
     */
    static getDeployedAddress(initCode, salt) {
        const saltBytes32 = ethers.utils.hexZeroPad(ethers.utils.hexlify(salt), 32)
        return (
            "0x" +
            ethers.utils
                .keccak256(
                    ethers.utils.hexConcat([
                        "0xff",
                        Create2Factory.contractAddress,
                        saltBytes32,
                        ethers.utils.keccak256(initCode),
                    ])
                )
                .slice(-40)
        )
    }

    // deploy the factory, if not already deployed.
    async deployFactory(signer) {
        if (await this._isFactoryDeployed()) {
            return
        }
        await (signer ?? this.signer).sendTransaction({
            to: Create2Factory.factoryDeployer,
            value: BigNumber.from(Create2Factory.factoryDeploymentFee),
        })
        await this.provider.sendTransaction(Create2Factory.factoryTx)
        if (!(await this._isFactoryDeployed())) {
            throw new Error("fatal: failed to deploy deterministic deployer")
        }
    }

    async _isFactoryDeployed() {
        if (!this.factoryDeployed) {
            const deployed = await this.provider.getCode(Create2Factory.contractAddress)
            if (deployed.length > 2) {
                this.factoryDeployed = true
            }
        }
        return this.factoryDeployed
    }
}
module.exports = {
    Create2Factory,
}
