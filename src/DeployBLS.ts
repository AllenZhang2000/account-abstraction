import { writeFileSync } from "fs";
import { createHash } from "crypto";

import { ethers } from "hardhat";

import { DeterministicDeployer } from "@account-abstraction/sdk";
import { EntryPoint__factory } from "@account-abstraction/contracts";

import config from "./config_BLS.json";

export const HARDHAT_CHAIN = 31337;
export const LOCAL_CHAIN = 1337;

async function deployEntryPoint(chainConfig) {
  chainConfig.entrypoint = {
    address: DeterministicDeployer.getAddress(EntryPoint__factory.bytecode),
  };
  let deployer = new DeterministicDeployer(ethers.provider);
  if (await deployer.isContractDeployed(chainConfig.entrypoint.address)) {
    console.log(`\tEntryPoint address: ${chainConfig.entrypoint.address}`);
    return;
  }
  if (
    chainConfig.chainId !== HARDHAT_CHAIN &&
    chainConfig.chainId !== LOCAL_CHAIN
  ) {
    throw new Error(
      `EntryPoint is not deployed on chain ${chainConfig.chainId}`
    );
  }
  await deployer.deterministicDeploy(EntryPoint__factory.bytecode);
  console.log(`\tEntryPoint address: ${chainConfig.entrypoint.address}`);
}

async function deployBundler(chainConfig) {
  if (chainConfig.chainId == HARDHAT_CHAIN) {
    const bundler = ethers.Wallet.createRandom();
    const address = await bundler.getAddress();
    chainConfig.bundler = { address };
    console.log(`\tBundler address: ${chainConfig.bundler.address}`);
  } else {
    if (!chainConfig.bundler.url)
      throw new Error(
        `Bundler url is not defined for chain ${chainConfig.chainId}`
      );
    console.log(`\tBundler url: ${chainConfig.bundler.url}`);
  }
}

async function deployContract(config, factory, contractDeployer) {
  const hash = createHash("sha256").update(factory.bytecode).digest("hex");
  if (
    !config ||
    !config.hash ||
    hash !== config.hash ||
    !config.address ||
    (await ethers.provider.getCode(config.address)) == "0x"
  ) {
    return contractDeployer(hash);
  }
}

async function deployGreeter(chainConfig) {
  const Greeter = await ethers.getContractFactory("Greeter");
  await deployContract(chainConfig.greeter, Greeter, async function (hash) {
    console.log(`\tDeploying Greeter`);
    const greeter = await Greeter.deploy("Hello World!");
    chainConfig.greeter = { address: greeter.address, hash };
  });
  console.log(`\tGreeter address: ${chainConfig.greeter.address}`);
}

async function deployBLSSignatureAggregator(chainConfig) {
  const BLSOpen = await ethers.getContractFactory("BLSOpen");

  const blsOpen = await BLSOpen.deploy();

  console.log(`\tBLSOpen address: ${blsOpen.address}`);

  const BLSSignatureAggregator = await ethers.getContractFactory(
    "BLSSignatureAggregator",
    {
      libraries: {
        BLSOpen: blsOpen.address,
      },
    }
  );
  await deployContract(
    chainConfig.aggregator,
    BLSSignatureAggregator,
    async function (hash) {
      console.log(`\tDeploying Aggregator`);
      const aggregator = await BLSSignatureAggregator.deploy(
        chainConfig.entrypoint.address
      );
      chainConfig.aggregator = { address: aggregator.address, hash };
    }
  );
  console.log(`\tAggregator address: ${chainConfig.aggregator.address}`);
}

async function deployFactory(chainConfig) {
  const Factory = await ethers.getContractFactory("BLSAccountFactory");
  await deployContract(chainConfig.factory, Factory, async function (hash) {
    console.log(`\tDeploying Factory`);
    const factory = await Factory.deploy(
      chainConfig.entrypoint.address,
      chainConfig.aggregator.address
    );
    chainConfig.factory = { address: factory.address, hash };
  });
  console.log(`\tFactory address: ${chainConfig.factory.address}`);
}

export async function deployAll(adminAddress) {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const chainConfig = config[chainId] || { chainId };

  await deployEntryPoint(chainConfig);
  await deployBundler(chainConfig);
  await deployGreeter(chainConfig);
  await deployBLSSignatureAggregator(chainConfig);
  await deployFactory(chainConfig);

  if (chainId !== HARDHAT_CHAIN) {
    config[chainId] = chainConfig;
    writeFileSync("./src/config_BLS.json", JSON.stringify(config, null, 2));
  }

  return chainConfig;
}
