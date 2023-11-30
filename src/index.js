const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const mcl = require("./bls/mcl.js");
const domainStr = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("eip4337.bls.domain")
);
// use env variable from .env
require("dotenv").config();
const { ALCHEMY_API_KEY } = process.env;

const BLSVERIFYINGABI = require("../artifacts/contracts/BLSVerifying.sol/BLSVerifying.json");
const blsverifyingAddress = "0x0F1cC0D35F4BFcf5815E32CE4b6D554020D92227";

// local storage
let keyPairs = [];
let signatures = [];
let publicKey;
let signature;
let messageExtended;

const app = express();
app.use(cors());

const g1ToHex = (g1) => {
  let g1Arr = mcl.g1ToBN(g1);
  return "0x" + g1Arr.map((bn) => bn.toHexString().slice(2)).join("");
};

const g2ToHex = (g2) => {
  let g2Arr = mcl.g2ToBN(g2);
  return "0x" + g2Arr.map((bn) => bn.toHexString().slice(2)).join("");
};

const init = async () => {
  await mcl.init();
  mcl.setMappingMode("TI");
  mcl.setDomain(domainStr);
};

init().then(() => console.log("mcl initialized"));

app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

// rest request to generate key pair
app.get("/api/keypair", async (req, res) => {
  const { pubkey, secret } = mcl.newKeyPair();
  keyPairs.push({ pubkey, secret });
  const pubHex = mcl.mclToHex(pubkey);
  const secHex = mcl.mclToHex(secret);
  res.json({ pubKey: pubHex, secKey: secHex });
  console.log("keyPairs", keyPairs);
});

// rest request to create multi-sig wallet
app.get("/api/wallet", async (req, res) => {
  let aggPublicKey = mcl.newG2();
  for (let i = 0; i < keyPairs.length; i++) {
    aggPublicKey = mcl.aggreagate(aggPublicKey, keyPairs[i].pubkey);
  }
  publicKey = aggPublicKey;
  const pubHex = g2ToHex(aggPublicKey);
  res.json({
    pubKey: pubHex,
    userOpHash:
      "0xe17cc0ef1eb5dcf1a03ee5686c1dee35c9f35c228b2655ac158cb64b1f124b42",
  });
});

// rest request to sign UserOps
app.get("/api/sign/:id", async (req, res) => {
  console.log("signing userOp for user ", req.params.id);
  // get id
  const id = req.params.id;
  const secKey = keyPairs[id].secret;
  console.log("secKey", secKey);
  const message =
    "0xef239e5087b12ac305700d3e44093fd6637a4b9ee42686ece50c4291482c1ffb";

  const { signature, M } = mcl.sign(message, secKey);
  signatures[id] = signature;
  messageExtended = M;
  const sigHex = mcl.mclToHex(signature);
  res.json({ sig: sigHex, message: g1ToHex(messageExtended) });
});

// rest request to aggregate signatures
app.get("/api/aggregate", async (req, res) => {
  console.log("aggregating signatures");
  const n = signatures.length;
  let aggSignature = mcl.newG1();
  for (let i = 0; i < n; i++) {
    aggSignature = mcl.aggreagate(aggSignature, signatures[i]);
  }
  signature = aggSignature;
  res.json({ aggSig: g1ToHex(aggSignature) });
});

// rest request to verify signature
app.get("/api/verify", async (req, res) => {
  console.log("verifying signature");
  const provider = new ethers.providers.JsonRpcProvider(
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  );

  const blsverifying = new ethers.Contract(
    blsverifyingAddress,
    BLSVERIFYINGABI.abi,
    provider
  );

  const messageBytes = g1ToHex(messageExtended);
  const pubkeyBytes = g2ToHex(publicKey);
  const sigBytes = g1ToHex(signature);

  const results = await blsverifying.validateUserOpSignature2(
    sigBytes,
    pubkeyBytes,
    messageBytes
  );

  console.log("results", results);

  res.json({
    message: messageBytes,
    aggPublicKey: pubkeyBytes,
    aggSignature: sigBytes,
  });
});

async function test() {
  await mcl.init();
  mcl.setMappingMode("TI");
  mcl.setDomain(domainStr);
  const provider = new ethers.providers.JsonRpcProvider(
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  );

  console.log("provider", provider);
  const blsverifying = new ethers.Contract(
    blsverifyingAddress,
    BLSVERIFYINGABI.abi,
    provider
  );

  const { pubkey, secret } = mcl.newKeyPair();
  const { signature, M } = mcl.sign(
    "0xe17cc0ef1eb5dcf1a03ee5686c1dee35c9f35c228b2655ac158cb64b1f124b42",
    secret
  );

  let message_ser = mcl.g1ToBN(M);
  let pubkey_ser = mcl.g2ToBN(pubkey);
  let sig_ser = mcl.g1ToBN(signature);

  const messageBytes =
    "0x" + message_ser.map((bn) => bn.toHexString().slice(2)).join("");
  const pubkeyBytes =
    "0x" + pubkey_ser.map((bn) => bn.toHexString().slice(2)).join("");
  const sigBytes =
    "0x" + sig_ser.map((bn) => bn.toHexString().slice(2)).join("");

  let result = await blsverifying.validateUserOpSignature2(
    sigBytes,
    pubkeyBytes,
    messageBytes
  );

  console.log("res", result);
}

test().then(() => console.log("test done"));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
