import { rpcRequest } from './utils/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BigNumber, Contract, ethers, utils } from 'ethers';
import { ERC20_ABI } from './utils/abis';
import { createTokenContracts, getErc20TokenData } from './utils/tokens';
import { TokenMapping } from './interfaces';
import { getErc20AllowancesFromApprovals } from './utils/allowances';
import { PROVIDER_URL } from './utils/constants';

const fromFloat = (floatString: string, decimals: number): string => {
  const sides = floatString.split('.');
  if (sides.length === 1)
    return floatString.padEnd(decimals + floatString.length, '0');
  if (sides.length > 2) return '0';

  return sides[1].length > decimals
    ? sides[0] + sides[1].slice(0, decimals)
    : sides[0] + sides[1].padEnd(decimals, '0');
};

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async getAllowances(chainId: number, address: string): Promise<TokenMapping> {
    // get latest block
    const url = PROVIDER_URL[chainId];
    const provider = new ethers.providers.JsonRpcProvider(url);
    const { data: latestBlockNumber } = await rpcRequest(url, {
      method: 'eth_blockNumber',
      params: [],
      id: 42,
    });
    this.logger.log(`latestBlockNumber: ${latestBlockNumber.result}`);

    // make an eth_call api to filter transfer events of the address
    const { data: transferLogs } = await rpcRequest(url, {
      method: 'eth_getLogs',
      params: [
        {
          fromBlock: '0x0',
          toBlock: latestBlockNumber.result,
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // transfer event
            null,
            utils.hexZeroPad(address, 32),
          ],
        },
      ],
      id: 43,
      jsonrpc: '2.0',
    });
    if (transferLogs.error) {
      throw new HttpException(
        transferLogs.error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
    this.logger.log(
      `transferLogs: ${transferLogs.result?.length} ${JSON.stringify(
        transferLogs.result,
      )}`,
    );

    const { data: approvalLogs } = await rpcRequest(url, {
      method: 'eth_getLogs',
      params: [
        {
          fromBlock: '0x0',
          toBlock: latestBlockNumber.result,
          topics: [
            '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // approval event
            utils.hexZeroPad(address, 32),
            null,
          ],
        },
      ],
      id: 43,
      jsonrpc: '2.0',
    });
    if (approvalLogs.error) {
      throw new HttpException(
        approvalLogs.error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
    this.logger.log(
      `approvalLogs: ${approvalLogs.result.length} ${JSON.stringify(
        approvalLogs.result,
      )}`,
    );
    // merge transferLogs and approvalLogs
    const logs = [...transferLogs.result];

    const contracts = createTokenContracts(logs, ERC20_ABI, provider);

    // based on that find the erc20 contract address with decimals, total supply, etc
    // iterate over the transfer logs
    const tokenMapping: any = {};
    if (!transferLogs.result.length) {
      throw new HttpException(
        'No transfer logs found for the address',
        HttpStatus.NOT_FOUND,
      );
    }
    for (const contract of contracts) {
      try {
        const contractAddress = contract.address.toLocaleLowerCase();
        this.logger.log(`address ${contractAddress}`);
        const [approvals, tokenData] = await Promise.all([
          getErc20AllowancesFromApprovals(
            contract,
            address,
            approvalLogs.result,
          ),
          getErc20TokenData(contract, address, tokenMapping),
        ]);
        tokenMapping[contractAddress] = {
          ...tokenData,
          chainId,
          approvals,
        };
      } catch (error) {
        this.logger.error(`error: ${JSON.stringify(error)}`);
      }
    }
    return tokenMapping;
  }

  async updateAllowances(
    chainId: number,
    tokenAddress: string,
    spender: string,
  ): Promise<string> {
    const url = PROVIDER_URL[chainId];
    const provider = new ethers.providers.JsonRpcProvider(url);
    const privateKey = process.env.WALLET_PVT_KEY;
    if (!privateKey) {
      throw new HttpException(
        'No private key found in env',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const signer = new ethers.Wallet(privateKey, provider);

    const tokenMapping: TokenMapping = {};
    const tokenContract = new Contract(
      utils.getAddress(tokenAddress),
      ERC20_ABI,
      signer,
    );
    const token = await getErc20TokenData(
      tokenContract,
      tokenAddress.toLocaleLowerCase(),
      tokenMapping,
    );
    const bnNew = BigNumber.from(fromFloat('0', token.decimals));
    this.logger.log(`Token data is ${JSON.stringify(token)}`);

    let tx;
    // Not all ERC20 contracts allow for simple changes in approval to be made
    // https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    // so we tell the user to revoke instead if the contract doesn't allow the simple use
    // of contract.approve(0)
    try {
      this.logger.debug(
        `Calling contract.approve(${spender}, ${bnNew.toString()})`,
      );
      tx = await tokenContract.functions.approve(spender, bnNew, {
        gasLimit: 2000000,
      });
    } catch (e) {
      const code = e.error?.code ?? e.code;
      if (code === -32000) {
        this.logger.error('Contract does not support simple approval changes');
      }
      this.logger.error(`Ran into issue while revoking ${e}`);
      throw new HttpException(e, HttpStatus.BAD_REQUEST);
    }

    if (tx) {
      await tx.wait(1);
      this.logger.log(`tx hash: ${tx.hash}`);
      // hash on goerli 0x264e5201cb8b0bf4231d616574b397dbeb8accf545116b2b080f91a58386f8b2 for setting allowance to 0
    }

    return tx.hash;
  }
}
