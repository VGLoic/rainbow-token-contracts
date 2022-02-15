// Rainbow Token
import rainbowTokenGoerliDeployment from "./deployments/goerli/RainbowToken.json";
import rainbowTokenLocalhostDeployment from "./deployments/localhost/RainbowToken.json";

export * from "./typechain";

enum Network {
    goerli = 5,
    localhost = 31337
}
type ContractAddresses = { [K in number]?: string }

function getNetworkAddressFactory(contractAddresses: ContractAddresses): ((network: number, addressOverrides?: ContractAddresses) => string) {
    return function getNetworkAddress(network: number, addressOverrides?: ContractAddresses) {
        if (addressOverrides) {
            const overridenAddress = addressOverrides[network];
            if (overridenAddress) return overridenAddress;
        }
        const address = contractAddresses[network];
        if (!address) {
            throw new Error(`Address not found for network: ${network}`);
        }
        return address;
    }
}

const rainbowTokenAddresses = {
    [Network.goerli]: rainbowTokenGoerliDeployment.address,
    [Network.localhost]: rainbowTokenLocalhostDeployment.address
};

const rainbowToken = {
    abi: rainbowTokenGoerliDeployment.abi,
    bytecode: rainbowTokenGoerliDeployment.bytecode,
    getNetworkAddress: getNetworkAddressFactory(rainbowTokenAddresses),
    addresses: rainbowTokenAddresses
}

export const contracts = { rainbowToken }