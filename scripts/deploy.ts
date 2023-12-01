import { ethers } from "hardhat";
import { HttpRpcClient, DefaultGasOverheads, SimpleAccountAPI } from '@account-abstraction/sdk';
import { DeterministicDeployer } from '@account-abstraction/sdk'
import { EntryPoint__factory } from '@account-abstraction/contracts'
import { aggregate, BlsSignerFactory, BlsVerifier } from '@thehubbleproject/bls/dist/signer'
import { arrayify, defaultAbiCoder, hexConcat, hexDataSlice } from 'ethers/lib/utils'
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
import { keccak256 } from 'ethereumjs-util'
import { BigNumber, Signer, Contract, errors } from 'ethers'
import { BytesLike, hexValue } from '@ethersproject/bytes'
import config from './config.json';

const DefaultsForUserOp = {
    sender: ethers.constants.AddressZero,
    nonce: 0,
    initCode: '0x',
    callData: '0x',
    callGasLimit: 0,
    verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 21000, // should also cover calldata cost.
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: '0x',
    signature: '0x'
}

async function deployBlsSignatureAggregator(entrypoint: string, etherSigner: Signer) {
    const BLSOpenLib = await new BLSOpen__factory(etherSigner).deploy()
    const blsAgg = await new BLSSignatureAggregator__factory({
        'contracts/bls/lib/BLSOpen.sol:BLSOpen': BLSOpenLib.address
    }, ethers.provider.getSigner()).deploy(entrypoint)
    console.log("Aggregator deployed at ", blsAgg.address);
    return blsAgg;
}

async function deployBlsAccount(ethersSigner: Signer, factoryAddr: string, blsSigner: any): Promise<BLSAccount> {
    const factory = BLSAccountFactory__factory.connect(factoryAddr, ethersSigner)
    const addr = await factory.callStatic.createAccount(0, blsSigner.pubkey)
    await factory.createAccount(0, blsSigner.pubkey)
    return BLSAccount__factory.connect(addr, ethersSigner)
}

export async function fillUserOp(op: any, entryPoint?: EntryPoint, getNonceFunction = 'getNonce') {
    const op1 = { ...op }
    const provider = entryPoint?.provider
    // if (op1.nonce == null) {
    //     if (provider == null) throw new Error('must have entryPoint to autofill nonce')
    //     const c = new Contract(op.sender!, [`function ${getNonceFunction}() view returns(uint256)`], provider)
    //     op1.nonce = await c[getNonceFunction]().catch(Error)
    // }
    if (op1.callGasLimit == null && op.callData != null) {
        if (provider == null) throw new Error('must have entryPoint for callGasLimit estimate')
        const gasEtimated = await provider.estimateGas({
            from: entryPoint?.address,
            to: op1.sender,
            data: op1.callData
        })

        // console.log('estim', op1.sender,'len=', op1.callData!.length, 'res=', gasEtimated)
        // estimateGas assumes direct call from entryPoint. add wrapper cost.
        op1.callGasLimit = gasEtimated // .add(55000)
    }
    if (op1.maxFeePerGas == null) {
        if (provider == null) throw new Error('must have entryPoint to autofill maxFeePerGas')
        const block = await provider.getBlock('latest')
        op1.maxFeePerGas = block.baseFeePerGas!.add(op1.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas)
    }
    // TODO: this is exactly what fillUserOp below should do - but it doesn't.
    // adding this manually
    if (op1.maxPriorityFeePerGas == null) {
        op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas
    }

    const partial: any = { ...op1 }
    // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
    // remove those so "merge" will succeed.
    for (const key in partial) {
        if (partial[key] == null) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete partial[key]
        }
    }
    const op2 = { ...DefaultsForUserOp, ...partial }
    return op2
}
async function sendUserOp(op: any) {

    const client = new HttpRpcClient(
        config[11155111].bundler.url,
        config[11155111].entrypoint.address,
        config[11155111].chainId
    );
    return client.sendUserOpToBundler(op)

}
async function main() {
    const entrypoint = config[11155111].entrypoint.address;
    const etherSigner = await ethers.provider.getSigner();
    const BLS_DOMAIN = arrayify(keccak256(Buffer.from('eip4337.bls.domain')));

    // const blsAgg = await deployBlsSignatureAggregator(entrypoint, etherSigner);
    const blsAgg = BLSSignatureAggregator__factory.connect(config[11155111].aggregator.address, etherSigner)

    const blsFactory = await BlsSignerFactory.new()
    const signer1 = blsFactory.getSigner(arrayify(BLS_DOMAIN), '0x01')
    const signer2 = blsFactory.getSigner(arrayify(BLS_DOMAIN), '0x02')
    // const accountDeployer = await new BLSAccountFactory__factory(etherSigner).deploy(entrypoint, blsAgg.address)
    // console.log("Account factory deployed at ", accountDeployer.address);

    // const account1 = await deployBlsAccount(etherSigner, config[11155111].factory.address, signer1)
    // console.log("Account1 deployed at ", account1.address);
    // const account2 = await deployBlsAccount(etherSigner, config[11155111].factory.address, signer2)
    // console.log("Account2 deployed at ", account2.address);

    const userOp1 = { ...DefaultsForUserOp, sender: '0x622c3b647C59456345df249420c7487b92D45875' }
    // await fillUserOp({
    //     sender: '0x622c3b647C59456345df249420c7487b92D45875'
    // }, EntryPoint__factory.connect(entrypoint, etherSigner))
    const requestHash = await blsAgg.getUserOpHash(userOp1)
    const sig1 = signer1.sign(requestHash)
    userOp1.signature = hexConcat(sig1)

    // const GreeterFactory = await ethers.getContractFactory("Greeter");
    // const greeter = GreeterFactory.attach(config[11155111].greeter.address);
    // const target = greeter.address;
    // const greeting = "Hola Mundo!";
    // const data = greeter.interface.encodeFunctionData('setGreeting', [greeting]);


    // const userOp2 = { ...DefaultsForUserOp, sender: '0xBE9fBe22316ad39a96CAC0dDe2199a5d55c6FBbD' }
    // // await fillUserOp({
    // //     sender: '0xBE9fBe22316ad39a96CAC0dDe2199a5d55c6FBbD'
    // // }, EntryPoint__factory.connect(entrypoint, etherSigner))
    // const requestHash2 = await blsAgg.getUserOpHash(userOp2)
    // const sig2 = signer2.sign(requestHash2)
    // userOp2.signature = hexConcat(sig2)


    // const aggSig = aggregate([sig1, sig2])
    // const aggregatedSig = await blsAgg.aggregateSignatures([userOp1, userOp2])

    // console.log("offchain:", hexConcat(aggSig))
    // console.log("onchain:", aggregatedSig)

    // const pubkeys = [
    //     signer1.pubkey,
    //     signer2.pubkey
    // ]
    // const v = new BlsVerifier(BLS_DOMAIN)
    // console.log("offchain verify: ", v.verifyMultiple(aggSig, pubkeys, [requestHash, requestHash2]))

    // console.log('onchain verify: ', await blsAgg.validateSignatures([userOp1, userOp2], aggregatedSig))
}

main()