import { HardhatRuntimeEnvironment } from "hardhat/types";

async function deployFunction(hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts();

    await hre.deployments.deploy("RainbowToken", {
        from: deployer,
        args: [210, 120, 70],
        log: true
    })
}

deployFunction.tags = ["RainbowToken"];

export default deployFunction;