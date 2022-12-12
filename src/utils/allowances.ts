import type { Log } from '@ethersproject/abstract-provider';
import { Contract, utils } from 'ethers';
import { IERC20Allowance } from '../interfaces';
import { convertString, unpackResult } from './promises';

const topicToAddress = (topic: string) =>
  utils.getAddress(utils.hexDataSlice(topic, 12));

export const getErc20AllowancesFromApprovals = async (
  contract: Contract,
  ownerAddress: string,
  approvals: Log[],
) => {
  const deduplicatedApprovals = approvals.filter(
    (approval, i) =>
      i ===
      approvals.findIndex((other) => approval.topics[2] === other.topics[2]),
  );

  const allowances: IERC20Allowance[] = await Promise.all(
    deduplicatedApprovals.map((approval) =>
      getErc20AllowanceFromApproval(contract, ownerAddress, approval),
    ),
  );

  return allowances.filter((allowance) => allowance.amount !== '0');
};

const getErc20AllowanceFromApproval = async (
  contract: Contract,
  ownerAddress: string,
  approval: Log,
) => {
  const spender = topicToAddress(approval.topics[2]);
  const amount = await convertString(
    unpackResult(contract.functions.allowance(ownerAddress, spender)),
  );

  return { spender, amount };
};
