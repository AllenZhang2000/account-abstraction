const express = require("express");
const cors = require("cors");
const mcl = require("./bls/mcl.js");
const { randHex } = require("./bls/utils.js");

const app = express();
app.use(cors());

const init = async () => {
  await mcl.init();
  mcl.setMappingMode("TI");
  mcl.setDomain("testing evmbls");
};

init().then(() => console.log("mcl initialized"));

// local storage
let keyPairs = [];
let signatures = [];
let aggPublicKey;
let aggSignature;

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
  aggPublicKey = mcl.newG2();
  for (let i = 0; i < keyPairs.length; i++) {
    aggPublicKey = mcl.aggreagate(aggPublicKey, keyPairs[i].pubkey);
  }
  const pubHex = mcl.mclToHex(aggPublicKey);
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
  signatures.push(signature);
  const sigHex = mcl.mclToHex(signature);
  res.json({ sig: sigHex });
});

// rest request to aggregate signatures
app.get("/api/aggregate", async (req, res) => {
  console.log("aggregating signatures");
  const n = signatures.length;
  aggSignature = mcl.newG1();
  for (let i = 0; i < n; i++) {
    aggSignature = mcl.aggreagate(aggSignature, signatures[i]);
  }
  console.log("aggSignature", aggSignature);
  res.json({ aggSig: mcl.mclToHex(aggSignature) });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
