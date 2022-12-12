import type { Log, Provider } from '@ethersproject/abstract-provider';
import { Contract, utils } from 'ethers/lib/ethers';
import { TokenMapping } from '../interfaces';
import { DUMMY_ADDRESS, DUMMY_ADDRESS_2 } from './constants';
import { convertString, unpackResult } from './promises';

export const throwIfNotErc20 = async (contract: Contract) => {
  // If the function allowance does not exist it will throw (and is not ERC20)
  const [allowance] = await contract.functions.allowance(
    DUMMY_ADDRESS,
    DUMMY_ADDRESS_2,
  );

  // The only acceptable value for checking the allowance from 0x00...01 to 0x00...02 is 0
  // This could happen when the contract is not ERC20 but does have a fallback function
  if (allowance.toString() !== '0') {
    throw new Error(
      'Response to allowance was not 0, indicating that this is not an ERC20 contract',
    );
  }
};

export const getErc20TokenData = async (
  contract: Contract,
  ownerAddress: string,
  tokenMapping: TokenMapping,
) => {
  const tokenData = tokenMapping[utils.getAddress(contract.address)];
  const [totalSupplyBN, balance, symbol, decimals] = await Promise.all([
    unpackResult(contract.functions.totalSupply()),
    convertString(unpackResult(contract.functions.balanceOf(ownerAddress))),
    // Use the tokenlist symbol + decimals if present (simplifies handing MKR et al)
    tokenData?.symbol ?? unpackResult(contract.functions.symbol()),
    tokenData?.decimals ?? unpackResult(contract.functions.decimals()),
    throwIfNotErc20(contract),
  ]);

  const totalSupply = totalSupplyBN.toString();
  return { symbol, decimals, totalSupply, balance };
};

export const createTokenContracts = (
  events: Log[],
  abi: any,
  provider: Provider,
) => {
  return events
    .filter(
      (event, i) =>
        i === events.findIndex((other) => event.address === other.address),
    )
    .map(
      (event) => new Contract(utils.getAddress(event.address), abi, provider),
    );
};
