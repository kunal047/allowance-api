import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { utils, Wallet } from 'ethers';
import { AppService } from './app.service';
import { APIResponseType } from './types';
import { PROVIDER_URL } from './utils/constants';

@Controller('allowances')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(':address')
  async getAllowances(
    @Param() params,
    @Query() query,
  ): Promise<APIResponseType> {
    const isValidChainId =
      !isNaN(query.chainId) &&
      Object.keys(PROVIDER_URL).includes(query.chainId);
    if (!isValidChainId) {
      throw new HttpException(
        'Please provide a valid chainId',
        HttpStatus.BAD_REQUEST,
      );
    }
    const isValidAddress = utils.isAddress(params.address);
    if (!params.address || !isValidAddress) {
      throw new HttpException(
        'Please provide a valid address',
        HttpStatus.BAD_REQUEST,
      );
    }
    // check if address is valid
    const result = await this.appService.getAllowances(
      query.chainId,
      params.address,
    );
    return {
      statusCode: 200,
      message: 'success',
      data: result,
    };
  }

  @Patch()
  async updateAllowances(@Body() body): Promise<APIResponseType> {
    const { chainId, tokenAddress, spender } = body;
    // check if chainId is valid
    const isValidChainId =
      !isNaN(chainId) && Object.keys(PROVIDER_URL).includes(chainId);
    const isValidTokenAddress = utils.isAddress(tokenAddress);
    const isValidSpender = utils.isAddress(spender);
    if (!isValidChainId || !isValidTokenAddress || !isValidSpender) {
      throw new HttpException(
        'Please provide a valid chainId, tokenAddress, and spender',
        HttpStatus.BAD_REQUEST,
      );
    }
    const hash = await this.appService.updateAllowances(
      chainId,
      tokenAddress,
      spender,
    );
    return {
      statusCode: 200,
      message: 'allowance updated to 0',
      data: {
        hash,
      },
    };
  }
}
