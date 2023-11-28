// const bls = require("bls-wasm");
const bls = require("bls-wasm");

function recoverSig(subIdVec, subSigVec) {
  const sig = new bls.Signature();
  const s = sig.recover(subSigVec, subIdVec);
  return sig.serializeToHexStr();
}

function sharing(n, k) {
  let msk = [];
  let mpk = [];
  let idVec = [];
  let secVec = [];

  /*
          setup master secret key
      */
  for (let i = 0; i < k; i++) {
    let sk = new bls.SecretKey();
    sk.setByCSPRNG();
    msk.push(sk);

    let pk = sk.getPublicKey();
    mpk.push(pk);
  }

  /*
          key sharing
      */
  for (let i = 0; i < n; i++) {
    let id = new bls.Id();
    id.setByCSPRNG();
    idVec.push(id);
    let sk = new bls.SecretKey();
    sk.share(msk, idVec[i]);
    secVec.push(sk);
  }

  const mpkHex = mpk[0].serializeToHexStr();
  return { mpkHex, idVec, secVec };
}

async function main() {
  await bls.init(4);
  console.log("bls order", bls.getCurveOrder());
  console.log("bl feild", bls.getFieldOrder());
  const k = 3;
  const n = 5;
  const msg = "hello world";

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
  console.log("sig", sigA, sigA.length);
  console.log("pub", mpkHex, mpkHex.length);

  // Verify the signature with the master public key
  const pub = new bls.PublicKey();
  const sig = new bls.Signature();
  pub.deserializeHexStr(mpkHex);
  sig.deserializeHexStr(sigA);
  console.log("verify", pub.verify(sig, msg));
}

main().catch(console.error);

module.exports = {
  recoverSig,
  sharing,
};
