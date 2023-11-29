const { expect } = require("chai");
const { ethers } = require("hardhat");
const bls = require("bls-wasm");
const mcl = require("../src/bls/mcl.js");
const { randHex } = require("../src/bls/utils.js");
const { recoverSig, sharing } = require("../src/bls/multi_sig.js");

describe("BLS on chain test with mcl", function () {
  let blsOpen;
  let blsverifying;

  // before all tests
  before(async function () {
    // Get the ContractFactory
    const BLSOpen = await ethers.getContractFactory("BLSOpen");
    blsOpen = await BLSOpen.deploy();
    console.log("blsOpen", blsOpen.address);
    const BLSVerifying = await ethers.getContractFactory("BLSVerifying", {
      libraries: {
        BLSOpen: blsOpen.address,
      },
    });

    blsverifying = await BLSVerifying.deploy();
    console.log("aggregator", blsverifying.address);

    await mcl.init();

    await bls.init(4);
  });

  it("Should validate single bls signature on chain with just mcl", async function () {
    mcl.setMappingMode("TI");
    mcl.setDomain("testing evmbls");

    const message = randHex(24);
    console.log("message", message);
    const { pubkey, secret } = mcl.newKeyPair();

    const { signature, M } = mcl.sign(message, secret);

    let message_ser = mcl.g1ToBN(M);
    let pubkey_ser = mcl.g2ToBN(pubkey);
    let sig_ser = mcl.g1ToBN(signature);

    const res = await blsverifying.validateUserOpSignature1(
      sig_ser,
      pubkey_ser,
      message_ser
    );

    expect(res).to.equal(true);
  });

  it("it should verify aggregated signatures on different messages on chain with mcl", async function () {
    mcl.setMappingMode("TI");
    mcl.setDomain("testing evmbls");
    const n = 2;
    const messages = [];
    const pubkeys = [];
    let aggSignature = mcl.newG1();
    for (let i = 0; i < n; i++) {
      const message = randHex(12);
      const { pubkey, secret } = mcl.newKeyPair();
      const { signature, M } = mcl.sign(message, secret);
      aggSignature = mcl.aggreagate(aggSignature, signature);
      messages.push(M);
      pubkeys.push(pubkey);
    }
    let messages_ser = messages.map((p) => mcl.g1ToBN(p));
    let pubkeys_ser = pubkeys.map((p) => mcl.g2ToBN(p));
    let sig_ser = mcl.g1ToBN(aggSignature);

    // console.log("messages_ser", messages_ser);
    // console.log("pubkeys_ser", pubkeys_ser);
    // console.log("sig_ser", sig_ser);

    let res = await blsverifying.validateMultipleUserOpSignature(
      sig_ser,
      pubkeys_ser,
      messages_ser
    );
    expect(res).to.equal(true);
  });

  it("it should verify aggregated signatures on same message on chain with mcl", async function () {
    mcl.setMappingMode("TI");
    mcl.setDomain("testing evmbls");
    const n = 2;
    const message = randHex(32);
    console.log("message", message, message.length);
    const pubkeys = [];
    let aggSignature = mcl.newG1();
    let aggPublicKey = mcl.newG2();
    let _M;
    for (let i = 0; i < n; i++) {
      const { pubkey, secret } = mcl.newKeyPair();
      const { signature, M } = mcl.sign(message, secret);
      _M = M;
      aggSignature = mcl.aggreagate(aggSignature, signature);
      aggPublicKey = mcl.aggreagate(aggPublicKey, pubkey);
      pubkeys.push(pubkey);
    }
    let message_ser = mcl.g1ToBN(_M);
    let pubkeys_ser = mcl.g2ToBN(aggPublicKey);
    let sig_ser = mcl.g1ToBN(aggSignature);

    const messageBytes = ethers.utils.concat(
      message_ser.map(ethers.utils.arrayify)
    );
    console.log("messageBytes", messageBytes);
    const hexString = Array.prototype.map
      .call(messageBytes, (x) => ("00" + x.toString(16)).slice(-2))
      .join("");

    const hashedHexString = ethers.utils.keccak256("0x" + hexString);

    console.log("message", hashedHexString);

    // console.log("message_ser", message_ser);
    // console.log("pubkeys_ser", pubkeys_ser);
    // console.log("sig_ser", sig_ser);

    let res = await blsverifying.validateUserOpSignature1(
      sig_ser,
      pubkeys_ser,
      message_ser
    );

    expect(res).to.equal(true);
  });

  it("Should validate bls signature on chain using validateUserOpSignature2", async function () {
    mcl.setMappingMode("TI");
    mcl.setDomain("testing evmbls");

    const message = randHex(12);
    const { pubkey, secret } = mcl.newKeyPair();

    const { signature, M } = mcl.sign(message, secret);

    let message_ser = mcl.g1ToBN(M);
    let pubkey_ser = mcl.g2ToBN(pubkey);
    let sig_ser = mcl.g1ToBN(signature);

    console.log("sig_ser", sig_ser);

    const messageBytes = ethers.utils.concat(
      message_ser.map(ethers.utils.arrayify)
    );
    const pubkeyBytes = ethers.utils.concat(
      pubkey_ser.map(ethers.utils.arrayify)
    );
    const sigBytes = ethers.utils.concat(sig_ser.map(ethers.utils.arrayify));

    const res = await blsverifying.validateUserOpSignature2(
      sigBytes,
      pubkeyBytes,
      messageBytes
    );

    expect(res).to.equal(true);
  });

  it("Should validate normal signing and multi-sig in bls-wasm off-chain", async function () {
    // should be 21888242871839275222246405745257275088696311157297823662689037894645226208583
    console.log("bls feild order", bls.getFieldOrder());

    const k = 3;
    const n = 5;
    const msg = "hello world";

    const secN = new bls.SecretKey();
    secN.setByCSPRNG();
    const pubN = secN.getPublicKey();
    const sigN = secN.sign(msg);
    expect(pubN.verify(sigN, msg)).to.equal(true);

    // Generate master public key
    // Generate n secret key shares with their corresponding id
    const { mpkHex, idVec, secVec } = sharing(n, k);

    // 3 participants sign the message with 3 secret key shares
    const sig1 = secVec[0].sign(msg);
    const sig2 = secVec[1].sign(msg);
    const sig3 = secVec[2].sign(msg);
    const subIdVec = idVec.slice(0, 3);

    // Recover the signature from the 3 partial signatures
    const sigA = recoverSig(subIdVec, [sig1, sig2, sig3]);
    console.log(
      `sig is ${sigA} with length ${sigA.length}, should be ${
        64 * 2
      } for verify on chain`
    );
    console.log(
      `mpk is ${mpkHex} with length ${mpkHex.length}, should be ${
        128 * 2
      } for verify on chain`
    );

    // Verify the signature with the master public key
    const pub = new bls.PublicKey();
    const sig = new bls.Signature();
    pub.deserializeHexStr(mpkHex);
    sig.deserializeHexStr(sigA);
    expect(pub.verify(sig, msg)).to.equal(true);
  });

  it("should convert bls-wasm library primitives to mcl primitives by directly set Uint32Array and verify on-chain", async function () {
    return;
    const sec = new bls.SecretKey();
    sec.setByCSPRNG();
    const pub = sec.getPublicKey();

    console.log("pub", pub.a_);
    console.log("sec", sec.a_);

    // convert to mcl primitives by directly set Uint32Array
    const { pubkey, secret } = mcl.newKeyPair();
    pubkey.a_ = pub.a_;
    secret.a_ = sec.a_;

    const message = randHex(12);
    const { signature, M } = mcl.sign(message, secret);

    let message_ser = mcl.g1ToBN(M);
    let pubkey_ser = mcl.g2ToBN(pubkey);
    let sig_ser = mcl.g1ToBN(signature);

    const res = await blsverifying.validateUserOpSignature1(
      sig_ser,
      pubkey_ser,
      message_ser
    );

    expect(res).to.equal(true);
  });

  it("should convert bls-wasm library primitives to mcl primitives by using hexToG2 hexToFr, and verify on-chain", async function () {
    return;
    const sec = new bls.SecretKey();
    sec.setByCSPRNG();
    const pub = sec.getPublicKey();

    // convert to mcl primitives using hexToG2 hexToFr
    const pubkey = mcl.hexToG2(pub.serializeToHexStr());
    const secret = mcl.hexToFr(sec.serializeToHexStr());

    const message = randHex(12);
    const { signature, M } = mcl.sign(message, secret);

    let message_ser = mcl.g1ToBN(M);
    let pubkey_ser = mcl.g2ToBN(pubkey);
    let sig_ser = mcl.g1ToBN(signature);

    const res = await blsverifying.validateUserOpSignature1(
      sig_ser,
      pubkey_ser,
      message_ser
    );

    expect(res).to.equal(true);
  });
});
