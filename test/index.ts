import { readFileSync, existsSync, writeFileSync } from "fs";
import { expect } from 'chai'
import { ethers } from "hardhat";

import { SimpleAccountAPI } from '@account-abstraction/sdk'
import * as EntryPoint from '@account-abstraction/contracts/artifacts/EntryPoint.json';

import { deployAll, LOCAL_CHAIN, HARDHAT_CHAIN } from "../src/Deploy";

import { HttpRpcClient, DefaultGasOverheads } from '@account-abstraction/sdk';

const MNEMONIC_FILE = 'mnemonic.txt';

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

async function sendUserOp(config, op){
    if (config.chainId === HARDHAT_CHAIN){
        const EntryPointFactory = await ethers.getContractFactory(EntryPoint.abi, EntryPoint.bytecode);
        const entrypoint = EntryPointFactory.attach(config.entrypoint.address);
        await entrypoint.handleOps([op], config.bundler.address);
        return entrypoint.getUserOpHash(op);
    }else{
        const client = new HttpRpcClient(
          config.bundler.url,
          config.entrypoint.address,
          config.chainId
        );
        return client.sendUserOpToBundler(op)
    }
}

describe("ERC-4337 Account Abstraction", function () {
    
    this.timeout(100000);
    
    let config;
    let greeter;
    let admin;
    let adminAccount;
    
    beforeEach(function() {
        if ( this.currentTest.parent.tests.some(test => test.state === "failed") )
            this.skip();
    });
  
    it("Should deploy the framework", async function () { 

        const [deployer] = await ethers.getSigners()
        console.log('\tDeployer address:', deployer.address)
        const balance = await deployer.getBalance();
        console.log(`\tDeployer balance: ${balance} (${ethers.utils.formatEther(balance)} eth)`)
        
        if (existsSync(MNEMONIC_FILE)){
            admin = ethers.Wallet.fromMnemonic(readFileSync(MNEMONIC_FILE, 'utf-8'));
        }else{
            admin = ethers.Wallet.createRandom().connect(ethers.provider);
            writeFileSync(MNEMONIC_FILE, admin.mnemonic.phrase, 'utf-8');
        }
        
        const minimumAmount = ethers.utils.parseEther('0.5');
        const adminAddress = await admin.getAddress();
        console.log(`\tAdmin address: ${adminAddress}`);

        if (await ethers.provider.getBalance(adminAddress) < minimumAmount){
            const tx = await deployer.sendTransaction({
                to: adminAddress,
                value: minimumAmount
            })
            await tx.wait();
        }
        
        const adminBalance = await ethers.provider.getBalance(adminAddress);
        console.log(`\tAdmin balance: ${adminBalance} (${ethers.utils.formatEther(adminBalance)} eth)`);
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
          overheads: {zeroByte: DefaultGasOverheads.nonZeroByte},
        });
        
        const accountAddress = await adminAccount.getAccountAddress();
        console.log(`\tAccount address: ${accountAddress}`);

        if (await ethers.provider.getBalance(accountAddress) < minimumAmount){
            const tx = await deployer.sendTransaction({
                to: accountAddress,
                value: minimumAmount
            })
            await tx.wait();
        }

        const accountBalance = await ethers.provider.getBalance(accountAddress);
        console.log(`\tAccount balance: ${accountBalance} (${ethers.utils.formatEther(accountBalance)} eth)`);
        expect(accountBalance).to.be.at.least(minimumAmount);        
    })  

  it("Should test Simple Account (without Paymaster)", async function () {
      
      const target = greeter.address;
      const greeting = "Hola Mundo!";
      const data = greeter.interface.encodeFunctionData('setGreeting', [greeting]);

      const op = await adminAccount.createSignedUserOp({ target, data });      
      
      // console.log("UserOperation: ", await ethers.utils.resolveProperties(op));
            
      const uoHash = await sendUserOp(config, op);
      console.log(`\tUserOperation hash: ${uoHash}`);

      const txHash = await adminAccount.getUserOpReceipt(uoHash);
      console.log(`\tTransaction hash: ${txHash}`);

      const tx = await ethers.provider.getTransaction(txHash);
      const receipt = await tx.wait()
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      console.log(`\tGas cost: ${gasCost} (${ethers.utils.formatEther(gasCost)} eth)`);
      expect(await greeter.greet()).to.equal(greeting);
  })
  
 

});
