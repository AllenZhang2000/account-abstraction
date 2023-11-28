import { readFileSync, existsSync, writeFileSync } from "fs";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SimpleAccountAPI } from "@account-abstraction/sdk";
import * as EntryPoint from "@account-abstraction/contracts/artifacts/EntryPoint.json";

import { deployAll, LOCAL_CHAIN, HARDHAT_CHAIN } from "../src/DeployBLS";

import { HttpRpcClient, DefaultGasOverheads } from "@account-abstraction/sdk";

const MNEMONIC_FILE = "mnemonic.txt";

// async function adjustVerificationGas(config, op){
//     if (config.chainId === HARDHAT_CHAIN || config.chainId === LOCAL_CHAIN ){
//         return op;
//     }
//     const signer = ethers.Wallet.createRandom();
//     const signature = await signer.signMessage('');
//     const client = new HttpRpcClient(
//       config.bundler.url,
//       config.entrypoint.address,
//       config.chainId
//     );
//     const {preVerificationGas, verificationGas} = await client.estimateUserOpGas({...op, signature});
//     op.preVerificationGas = ethers.BigNumber.from(preVerificationGas).toNumber();
//     op.verificationGasLimit = ethers.BigNumber.from(verificationGas);
// }

async function sendUserOp(config, op) {
  if (config.chainId === HARDHAT_CHAIN) {
    const EntryPointFactory = await ethers.getContractFactory(
      EntryPoint.abi,
      EntryPoint.bytecode
    );
    const entrypoint = EntryPointFactory.attach(config.entrypoint.address);
    await entrypoint.handleOps([op], config.bundler.address);
    return entrypoint.getUserOpHash(op);
  } else {
    const client = new HttpRpcClient(
      config.bundler.url,
      config.entrypoint.address,
      config.chainId
    );
    return client.sendUserOpToBundler(op);
  }
}

describe("BLS ERC-4337 Account Abstraction", function () {
  this.timeout(100000);

  let config;
  let greeter;
  let admin;
  let adminAccount;

  beforeEach(function () {
    if (this.currentTest.parent.tests.some((test) => test.state === "failed"))
      this.skip();
  });

  it("Should deploy the framework", async function () {
    const [deployer] = await ethers.getSigners();
    console.log("\tDeployer address:", deployer.address);
    const balance = await deployer.getBalance();
    console.log(
      `\tDeployer balance: ${balance} (${ethers.utils.formatEther(
        balance
      )} eth)`
    );

    if (existsSync(MNEMONIC_FILE)) {
      admin = ethers.Wallet.fromMnemonic(readFileSync(MNEMONIC_FILE, "utf-8"));
    } else {
      admin = ethers.Wallet.createRandom().connect(ethers.provider);
      writeFileSync(MNEMONIC_FILE, admin.mnemonic.phrase, "utf-8");
    }

    const minimumAmount = ethers.utils.parseEther("0.5");
    const adminAddress = await admin.getAddress();
    console.log(`\tAdmin address: ${adminAddress}`);

    if ((await ethers.provider.getBalance(adminAddress)) < minimumAmount) {
      const tx = await deployer.sendTransaction({
        to: adminAddress,
        value: minimumAmount,
      });
      await tx.wait();
    }

    const adminBalance = await ethers.provider.getBalance(adminAddress);
    console.log(
      `\tAdmin balance: ${adminBalance} (${ethers.utils.formatEther(
        adminBalance
      )} eth)`
    );
    expect(adminBalance).to.be.at.least(minimumAmount);

    config = await deployAll(adminAddress);

    const GreeterFactory = await ethers.getContractFactory("Greeter");
    greeter = GreeterFactory.attach(config.greeter.address);
    const greeting = "Hello World!";
    const tx = await greeter.setGreeting(greeting);
    await tx.wait();
    expect(await greeter.greet()).to.equal(greeting);

    adminAccount = new SimpleAccountAPI({
      provider: ethers.provider,
      entryPointAddress: config.entrypoint.address,
      owner: admin,
      factoryAddress: config.factory.address,
      overheads: { zeroByte: DefaultGasOverheads.nonZeroByte },
    });

    const accountAddress = await adminAccount.getAccountAddress();
    console.log(`\tAccount address: ${accountAddress}`);

    if ((await ethers.provider.getBalance(accountAddress)) < minimumAmount) {
      const tx = await deployer.sendTransaction({
        to: accountAddress,
        value: minimumAmount,
      });
      await tx.wait();
    }

    const accountBalance = await ethers.provider.getBalance(accountAddress);
    console.log(
      `\tAccount balance: ${accountBalance} (${ethers.utils.formatEther(
        accountBalance
      )} eth)`
    );
    expect(accountBalance).to.be.at.least(minimumAmount);
  });

  it("Should test Simple Account (without Paymaster)", async function () {
    const target = greeter.address;
    const greeting = "Hola Mundo!";
    const data = greeter.interface.encodeFunctionData("setGreeting", [
      greeting,
    ]);

    const a = await greeter.greet();
    console.log(`\tGreeter: ${a}`);

    console.log(
      `Error: cannot estimate gas; transaction may fail or may require manual gas limit [ See: https://links.ethers.org/v5-errors-UNPREDICTABLE_GAS_LIMIT ] (reason="Transaction reverted: function selector was not recognized and there's no fallback function", method="estimateGas", transaction={"to":"0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e","data":"0x5fbfb9cf000000000000000000000000b6f0017589842906580c289e3bf7dec0b2b341470000000000000000000000000000000000000000000000000000000000000000","accessList":null}, error={"stackTrace":[{"type":11,"sourceReference":{"sourceName":"contracts/bls/BLSAccountFactory.sol","sourceContent":"// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.12;\n\nimport \"@openzeppelin/contracts/utils/Create2.sol\";\nimport \"@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol\";\n\nimport \"@account-abstraction/contracts/interfaces/IEntryPoint.sol\";\nimport \"./BLSAccount.sol\";\n\n/* solhint-disable no-inline-assembly */\n\n/**\n * Based on SimpleAccountFactory.\n * Cannot be a subclass since both constructor and createAccount depend on the\n * constructor and initializer of the actual account contract.\n */\ncontract BLSAccountFactory {\n    BLSAccount public immutable accountImplementation;\n\n    constructor(IEntryPoint entryPoint, address aggregator){\n        accountImplementation = new BLSAccount(entryPoint, aggregator);\n    }\n\n    /**\n     * create an account, and return its address.\n     * returns the address even if the account is already deployed.\n     * Note that during UserOperation execution, this method is called only if the account is not deployed.\n     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation\n     * Also note that our BLSSignatureAggregator requires that the public key is the last parameter\n     */\n    function createAccount(uint256 salt, uint256[4] calldata aPublicKey) public returns (BLSAccount) {\n\n        // the BLSSignatureAggregator depends on the public-key being the last 4 uint256 of msg.data.\n        uint slot;\n        assembly {slot := aPublicKey}\n        require(slot == msg.data.length - 128, \"wrong pubkey offset\");\n\n        address addr = getAddress(salt, aPublicKey);\n        uint codeSize = addr.code.length;\n        if (codeSize > 0) {\n            return BLSAccount(payable(addr));\n        }\n        return BLSAccount(payable(new ERC1967Proxy{salt : bytes32(salt)}(\n                address(accountImplementation),\n                abi.encodeCall(BLSAccount.initialize, aPublicKey)\n            )));\n    }\n\n    /**\n     * calculate the counterfactual address of this account as it would be returned by createAccount()\n     */\n    function getAddress(uint256 salt, uint256[4] memory aPublicKey) public view returns (address) {\n        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(\n                type(ERC1967Proxy).creationCode,\n                abi.encode(\n                    address(accountImplementation),\n                    abi.encodeCall(BLSAccount.initialize, (aPublicKey))\n                )\n            )));\n    }\n}\n","contract":"BLSAccountFactory","line":17,"range":[502,2470]}}],"data":"0x"}, code=UNPREDICTABLE_GAS_LIMIT, version=providers/5.7.2)`
    );

    const op = await adminAccount.createSignedUserOp({
      target,
      data,
      value: "1000000",
      gasLimit: "1000000",
    });

    console.log("UserOperation: ", await ethers.utils.resolveProperties(op));

    const uoHash = await sendUserOp(config, op);
    console.log(`\tUserOperation hash: ${uoHash}`);

    const txHash = await adminAccount.getUserOpReceipt(uoHash);
    console.log(`\tTransaction hash: ${txHash}`);

    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    console.log(
      `\tGas cost: ${gasCost} (${ethers.utils.formatEther(gasCost)} eth)`
    );
    expect(await greeter.greet()).to.equal(greeting);
  });
});
