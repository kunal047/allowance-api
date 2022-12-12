export interface TokenFromList {
  symbol: string;
  totalSupply: string;
  chainId: number;
  balance: string;
  // Only for ERC20
  decimals?: number;
  approvals: Array<IERC20Allowance>;
}

export interface TokenMapping {
  [index: string]: TokenFromList;
}

export interface IERC20Allowance {
  spender: string;
  amount: string;
}
