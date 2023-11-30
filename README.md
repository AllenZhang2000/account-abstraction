
# Project overview:
This project aims to assess the capability of various BLS libraries in enabling BLS signatures and BLS Threshold cryptography directly on the blockchain.

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
  - ### `test.js`
    - contains the main BLS tests, some of it will fail to show the limitation of certain BLS Library
  - ### `testBLS.js`
    - tests deploy BLS account abstraction, **ignore it for the scope of this project**
  - ## run test with `npx hardhat test`
 
# Project Results and future work
## To do single BLS signature verification & aggregated BLS signature verification on chain, you need:
  - a JavaScript library implement BLS signature schema with curve *BN254*, also known as *BN128 (128 previously referred to the bits of security)* or
*alt_bn_128*
    - This is because Ethereum only supports *BN254*
    - It's crucial to verify the curve order with methods like `bls.getFieldOrder()`, ensuring it precisely matches `21888242871839275222246405745257275088696311157297823662689037894645226208583`, which is approximately `2^254`.
    - Note there is a different curve also called *BN254* with order `16798108731015832284940804142231733909889187121439069848933715426072753864723`, do not use this one
    - The library [mcl-wasm](https://www.npmjs.com/package/mcl-wasm) used in [the evmbls repo](https://github.com/kilic/evmbls/tree/master) is verified to work 
  - a Solidity library that verifies BLS signatures
## To do BLS threshold signature on chain, you need
  - a JavaScript library implement BLS signature schema with curve *BN254* similar to the one mentioned above
  - A Shamir secret-sharing library operating over the same field, with an order approximately equal to 2^254.
    - Note most Shamir secret-sharing libraries, like [Shamir's Secret Sharing on npm](https://www.npmjs.com/package/shamirs-secret-sharing), are typically implemented over a field with an order of 2^8. It's important to verify the field order before usage.
    - some libraries integrate the BLS schema with Shamir secret-sharing already:
        - like [bls-wasm](https://www.npmjs.com/package/bls-wasm), this is also the one I used in `multi-sig.js`, unfortunately, it only produces compressed primitives (secret, public key, signature), and BLS on chain requires the uncompressed primitives.
        - I also tested [bls-eth-wasm](https://www.npmjs.com/package/bls-eth-wasm), it can produce uncompressed primitives with curve *BLS12_381*, directly using *BN254* (initialize with `bls.init(4)`) will cause error. I tried to directly modify the src files and force it to work with *BN254*. It then can produce uncompressed signatures, but the public key and secret are still compressed. **Still, the above two libraries are very promising for achieving the BLS threshold signature on the chain once they fix the issue.**
  - a Solidity library that verifies BLS signatures



