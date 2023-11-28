const { ethers } = require("ethers");
const { toBig, FIELD_ORDER, bigToHex, randHex } = require("./utils");
const { hashToField } = require("./hash_to_field");

const mcl = require("mcl-wasm");

const MAPPING_MODE_TI = "TI";
const MAPPING_MODE_FT = "FT";

async function init() {
  await mcl.init(mcl.BN_SNARK1);
  setMappingMode(MAPPING_MODE_FT);
}

function setDomain(domain) {
  DOMAIN = Uint8Array.from(Buffer.from(domain, "utf8"));
}

function setDomainHex(domain) {
  DOMAIN = Uint8Array.from(Buffer.from(domain, "hex"));
}

function setMappingMode(mode) {
  if (mode === MAPPING_MODE_FT) {
    mcl.setMapToMode(0);
  } else if (mode === MAPPING_MODE_TI) {
    mcl.setMapToMode(1);
  } else {
    throw new Error("unknown mapping mode");
  }
}

function hashToPoint(msg) {
  if (!ethers.utils.isHexString(msg)) {
    throw new Error("message is expected to be hex string");
  }

  const _msg = Uint8Array.from(Buffer.from(msg.slice(2), "hex"));
  const hashRes = hashToField(DOMAIN, _msg, 2);
  const e0 = hashRes[0];
  const e1 = hashRes[1];
  const p0 = mapToPoint(e0.toHexString());
  const p1 = mapToPoint(e1.toHexString());
  const p = mcl.add(p0, p1);
  p.normalize();
  return p;
}

function mapToPoint(eHex) {
  const e0 = toBig(eHex);
  let e1 = new mcl.Fp();
  e1.setStr(e0.mod(FIELD_ORDER).toString());
  return e1.mapToG1();
}

function mclToHex(p, prefix = true) {
  const arr = p.serialize();
  let s = "";
  for (let i = arr.length - 1; i >= 0; i--) {
    s += ("0" + arr[i].toString(16)).slice(-2);
  }
  return prefix ? "0x" + s : s;
}

function hexToG2(hex) {
  return mcl.deserializeHexStrToG2(hex);
}

function hexToG1(hex) {
  return mcl.deserializeHexStrToG1(hex);
}

function hexToFr(hex) {
  return mcl.deserializeHexStrToFr(hex);
}

function g1() {
  const g1 = new mcl.G1();
  g1.setStr("1 0x01 0x02", 16);
  return g1;
}

function g2() {
  const g2 = new mcl.G2();
  g2.setStr(
    "1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b"
  );
  return g2;
}

function signOfG1(p) {
  const y = toBig(mclToHex(p.getY()));
  const ONE = toBig(1);
  return y.and(ONE).eq(ONE);
}

function signOfG2(p) {
  p.normalize();
  const y = mclToHex(p.getY(), false);
  const ONE = toBig(1);
  return toBig("0x" + y.slice(64))
    .and(ONE)
    .eq(ONE);
}

function g1ToCompressed(p) {
  const MASK = toBig(
    "0x8000000000000000000000000000000000000000000000000000000000000000"
  );
  p.normalize();
  if (signOfG1(p)) {
    const x = toBig(mclToHex(p.getX()));
    const masked = x.or(MASK);
    return bigToHex(masked);
  } else {
    return mclToHex(p.getX());
  }
}

function g1ToBN(p) {
  p.normalize();
  const x = toBig(mclToHex(p.getX()));
  const y = toBig(mclToHex(p.getY()));
  return [x, y];
}

function g1ToHex(p) {
  p.normalize();
  const x = mclToHex(p.getX());
  const y = mclToHex(p.getY());
  return [x, y];
}

function g2ToCompressed(p) {
  const MASK = toBig(
    "0x8000000000000000000000000000000000000000000000000000000000000000"
  );
  p.normalize();
  const x = mclToHex(p.getX(), false);
  if (signOfG2(p)) {
    const masked = toBig("0x" + x.slice(64)).or(MASK);
    return [bigToHex(masked), "0x" + x.slice(0, 64)];
  } else {
    return ["0x" + x.slice(64), "0x" + x.slice(0, 64)];
  }
}

function g2ToBN(p) {
  const x = mclToHex(p.getX(), false);
  const y = mclToHex(p.getY(), false);
  return [
    toBig("0x" + x.slice(64)),
    toBig("0x" + x.slice(0, 64)),
    toBig("0x" + y.slice(64)),
    toBig("0x" + y.slice(0, 64)),
  ];
}

function g2ToHex(p) {
  p.normalize();
  const x = mclToHex(p.getX(), false);
  const y = mclToHex(p.getY(), false);
  return [
    "0x" + x.slice(64),
    "0x" + x.slice(0, 64),
    "0x" + y.slice(64),
    "0x" + y.slice(0, 64),
  ];
}

function newKeyPair() {
  const secret = randFr();
  const pubkey = mcl.mul(g2(), secret);
  pubkey.normalize();
  return { pubkey, secret };
}

function sign(message, secret) {
  const M = hashToPoint(message);
  const signature = mcl.mul(M, secret);
  signature.normalize();
  return { signature, M };
}

function aggreagate(acc, other) {
  const _acc = mcl.add(acc, other);
  _acc.normalize();
  return _acc;
}

function compressPubkey(p) {
  return g2ToCompressed(p);
}

function compressSignature(p) {
  return g1ToCompressed(p);
}

function newG1() {
  return new mcl.G1();
}

function newG2() {
  return new mcl.G2();
}

function randFr() {
  const r = randHex(12);
  let fr = new mcl.Fr();
  fr.setHashOf(r);
  return fr;
}

function randG1() {
  const p = mcl.mul(g1(), randFr());
  p.normalize();
  return p;
}

function randG2() {
  const p = mcl.mul(g2(), randFr());
  p.normalize();
  return p;
}

module.exports = {
  init,
  setDomain,
  setDomainHex,
  setMappingMode,
  hashToPoint,
  mapToPoint,
  mclToHex,
  g1,
  g2,
  signOfG1,
  signOfG2,
  g1ToCompressed,
  g1ToBN,
  g1ToHex,
  g2ToCompressed,
  g2ToBN,
  g2ToHex,
  newKeyPair,
  sign,
  aggreagate,
  compressPubkey,
  compressSignature,
  newG1,
  newG2,
  randFr,
  randG1,
  randG2,
  hexToG1,
  hexToG2,
  hexToFr,
};
