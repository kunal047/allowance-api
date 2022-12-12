export const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001';
export const DUMMY_ADDRESS_2 = '0x0000000000000000000000000000000000000002';
// fetch it from env variables in production
export const PROVIDER_URL = {
  1: process.env.ETH_MAINNET_URL,
  5: process.env.ETH_GOERLI_URL,
  137: process.env.MATIC_MAINNET_URL,
  80001: process.env.MATIC_MUMBAI_URL,
};
