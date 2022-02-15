import { JsonFragment, Fragment } from "@ethersproject/abi";
// Rainbow Token
import rainbowTokenGoerliDeployment from "./deployments/goerli/RainbowToken.json";
import rainbowTokenLocalhostDeployment from "./deployments/localhost/RainbowToken.json";

export * from "./typechain";

export enum Network {
    goerli = 5,
    localhost = 31337
}

export type NetworkConfiguration = {
    abi: (string | JsonFragment | Fragment)[],
    bytecode: string,
    address: string
}
export type NetworkConfigurations = Record<number, NetworkConfiguration>;

function getNetworkConfigurationFactory(networkConfigurations: NetworkConfigurations): ((network: number) => NetworkConfiguration) {
    return function getNetworkConfiguration(network: number) {
        const config = networkConfigurations[network];
        if (!config) {
            throw new Error(`Configuration not found for network: ${network}`);
        }
        return config;
    }
}
function isNetworkSupportedFactory(networkConfigurations: NetworkConfigurations): ((network: number) => boolean) {
    return function isNetworkSupported(network: number) {
        const config = networkConfigurations[network];
        return Boolean(config);
    }
}

const rainbowTokenConfigurations: NetworkConfigurations = {
    [Network.goerli]: {
        abi: rainbowTokenGoerliDeployment.abi,
        bytecode: rainbowTokenGoerliDeployment.bytecode,
        address: rainbowTokenGoerliDeployment.address
    },
    [Network.localhost]: {
        abi: rainbowTokenLocalhostDeployment.abi,
        bytecode: rainbowTokenLocalhostDeployment.bytecode,
        address: rainbowTokenLocalhostDeployment.address
    }
}

const rainbowToken = {
    supportedNetworks: Object.keys(rainbowTokenConfigurations),
    isNetworkSupported: isNetworkSupportedFactory(rainbowTokenConfigurations),
    getNetworkConfiguration: getNetworkConfigurationFactory(rainbowTokenConfigurations),
}

export const contracts = { rainbowToken }