/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface RegisterSystemInterface extends utils.Interface {
  contractName: "RegisterSystem";
  functions: {
    "execute(bytes)": FunctionFragment;
    "owner()": FunctionFragment;
    "requirement(bytes)": FunctionFragment;
  };

  encodeFunctionData(functionFragment: "execute", values: [BytesLike]): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(functionFragment: "requirement", values: [BytesLike]): string;

  decodeFunctionResult(functionFragment: "execute", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "requirement", data: BytesLike): Result;

  events: {};
}

export interface RegisterSystem extends BaseContract {
  contractName: "RegisterSystem";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: RegisterSystemInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    "execute(bytes)"(
      arguments: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    "execute(address,uint8,address,uint256)"(
      msgSender: string,
      registerType: BigNumberish,
      addr: string,
      id: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    owner(overrides?: CallOverrides): Promise<[string]>;

    requirement(arguments: BytesLike, overrides?: CallOverrides): Promise<[string]>;
  };

  "execute(bytes)"(
    arguments: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  "execute(address,uint8,address,uint256)"(
    msgSender: string,
    registerType: BigNumberish,
    addr: string,
    id: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  owner(overrides?: CallOverrides): Promise<string>;

  requirement(arguments: BytesLike, overrides?: CallOverrides): Promise<string>;

  callStatic: {
    "execute(bytes)"(arguments: BytesLike, overrides?: CallOverrides): Promise<string>;

    "execute(address,uint8,address,uint256)"(
      msgSender: string,
      registerType: BigNumberish,
      addr: string,
      id: BigNumberish,
      overrides?: CallOverrides
    ): Promise<string>;

    owner(overrides?: CallOverrides): Promise<string>;

    requirement(arguments: BytesLike, overrides?: CallOverrides): Promise<string>;
  };

  filters: {};

  estimateGas: {
    "execute(bytes)"(
      arguments: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    "execute(address,uint8,address,uint256)"(
      msgSender: string,
      registerType: BigNumberish,
      addr: string,
      id: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    requirement(arguments: BytesLike, overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    "execute(bytes)"(
      arguments: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    "execute(address,uint8,address,uint256)"(
      msgSender: string,
      registerType: BigNumberish,
      addr: string,
      id: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    requirement(arguments: BytesLike, overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
