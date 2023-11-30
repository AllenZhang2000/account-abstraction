const { ethers } = require("hardhat");

async function main() {
  const BLSOpen = await ethers.getContractFactory("BLSOpen");
  const blsOpen = await BLSOpen.deploy();
  console.log("blsOpen", blsOpen.address);
  const BLSVerifying = await ethers.getContractFactory("BLSVerifying", {
    libraries: {
      BLSOpen: blsOpen.address,
    },
  });

  const blsverifying = await BLSVerifying.deploy();
  console.log("verifyer", blsverifying.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
