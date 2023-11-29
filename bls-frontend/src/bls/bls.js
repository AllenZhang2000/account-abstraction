const { ethers } = require("ethers");
const bls = require("bls-wasm");
const mcl = require("./mcl.js");

export async function init() {
  await mcl.init();
}

export function createKeyPair() {
  return mcl.newKeyPair();
}

export function sign(message, secret) {
  return mcl.sign(message, secret);
}

export function multiSign(message, secrets) {}
