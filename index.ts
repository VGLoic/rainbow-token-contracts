// Rainbow Token
import rainbowTokenGoerliDeployment from "./deployments/goerli/RainbowToken.json";

export * from "./typechain";

enum Network {
    goerli = 5,
    local = 31337
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
};

const rainbowToken = {
    abi: rainbowTokenGoerliDeployment.abi,
    bytecode: rainbowTokenGoerliDeployment.bytecode,
    getNetworkAddress: getNetworkAddressFactory(rainbowTokenAddresses),
    addresses: rainbowTokenAddresses
}

export const contracts = { rainbowToken }