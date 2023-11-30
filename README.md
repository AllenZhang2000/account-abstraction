

# Project overview:
This project attempts to test various BLS libraries to achieve BLS signature and BLS Threshold on-chain. 

1. Create a `.env` file with the following under root: 

```
ALCHEMY_API_KEY=
METAMASK_PRIVATE_KEY=
ETHERSCAN_API_KEY=
```
2. `npm install`

- ## `/Contracts` Structure 
  - ### Directory Structure
    - **Contracts**: All smart contracts are located in the `/contracts` directory.
    - **BLS Library**: The BLS (Boneh-Lynn-Shacham) cryptographic library is situated in `/contracts/lib`. This library provides essential functionalities for BLS signature verification.

  - ### BLSVerifying.sol
    - This smart contract, named `BLSVerifying.sol`, is primarily used for testing BLS signature verification. It is located within the `/contracts` directory.
    - The contract utilizes the `BLSOpen.verifySingle` function from the BLS library in `/contracts/lib`. This function is crucial for verifying BLS signatures.
    - The contract includes three distinct tests for BLS verification: `validateUserOpSignature1`, `validateUserOpSignature2`, and `validateUserOpSignature3`.
    - Each of these tests is designed to check the functionality and reliability of BLS signature verification against various input types. This ensures the robustness and accuracy of the BLS implementation in different scenarios.
- ## `/Src` Structure
  - ### Create a `.env` file with the following under `/src`:
        ```
        ALCHEMY_API_KEY=
        ```
  - ### `DeployBLS.ts` and `config_BLS.json`
    - These two files attempt to deploy BLS account abstraction, **ignore them for the scope of this project**
  - ### `/bls`
    - Files inside this folder used `mcl-wasm` library to do BLS signature
  - ### `multi_sig.js`
    - This file verifies the ability to do BLS threshold signature off-chain with `bls-wasm` library
    - Run it using `node multi_sig.js`
  - ### `index.js`
    - Backend for bls-frontend, run with `node index.js`
- ## `bls-frontend` Structure
  - `npm install`
  - `npm run`
- ## `scripts` structure
  - deploy `BLSVerifying.sol` with `npx hardhat run scripts/deploy.js --network sepolia`
- ## `test` structure
  - ### `test.js` contains the main BLS tests, some of it will fail to show the limitation of certain BLS Library
  - ### `testBLS.js` tests deploy BLS account abstraction, **ignore it for the scope of this project**
  - ### run test with `npx hardhat test`

