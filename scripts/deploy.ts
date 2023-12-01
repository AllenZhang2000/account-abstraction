import { writeFileSync } from "fs";
import { createHash } from 'crypto';

import { ethers } from "hardhat";

import { DeterministicDeployer } from '@account-abstraction/sdk'
import { EntryPoint__factory } from '@account-abstraction/contracts'
import { aggregate, BlsSignerFactory, BlsVerifier } from '@thehubbleproject/bls/dist/signer'
import { arrayify, defaultAbiCoder, hexConcat } from 'ethers/lib/utils'
import {
    BLSOpen__factory,
    BLSSignatureAggregator__factory,
    BLSAccount,
    BLSAccount__factory,
    BLSAccountFactory,
    BLSAccountFactory__factory,

} from '../typechain-types'
import {
    BrokenBLSAccountFactory__factory,
    EntryPoint
} from '@account-abstraction/contracts/types'

import * as SimpleAccountFactory from '@account-abstraction/contracts/artifacts/SimpleAccountFactory.json';
import * as SimpleAccount from '@account-abstraction/contracts/artifacts/SimpleAccount.json';
import { keccak256 } from 'ethereumjs-util'
import { hashToPoint } from '@thehubbleproject/bls/dist/mcl'
import { BigNumber, Signer } from 'ethers'
import { BytesLike, hexValue } from '@ethersproject/bytes'
import config from './config.json';
import * as BLSSignatureAggregator from '../artifacts/contracts/bls/BLSSignatureAggregator.sol/BLSSignatureAggregator.json';
export const HARDHAT_CHAIN = 31337;
export const LOCAL_CHAIN = 1337;




async function deployBlsSignatureAggregator() {
    const etherSigner = await ethers.provider.getSigner();
    const entrypoint = config[11155111].entrypoint.address;
    const BLSOpenLib = await new BLSOpen__factory(etherSigner).deploy()
    const blsAgg = await new BLSSignatureAggregator__factory({
        'contracts/bls/lib/BLSOpen.sol:BLSOpen': BLSOpenLib.address
    }, ethers.provider.getSigner()).deploy(entrypoint)
    console.log("Aggregator deployed at ", blsAgg.address);
    const accountFactory = await new BLSAccountFactory__factory(etherSigner).deploy(entrypoint, blsAgg.address);
    console.log("AccountFactory deployed at ", accountFactory.address);
}

async function deployBlsAccount(blsSigner: any): Promise<BLSAccount> {
    const etherSigner = await ethers.provider.getSigner();

    const factory = BLSAccountFactory__factory.connect(config[11155111].factory.address, etherSigner)
    const addr = await factory.callStatic.createAccount(0, blsSigner.pubkey)
    await factory.createAccount(0, blsSigner.pubkey)
    return BLSAccount__factory.connect(addr, etherSigner)
}

deployBlsSignatureAggregator();