import React, { useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import BLSVERIFYINGABI from "./bls/BLSVerifying.json";
const blsverifyingAddress = "0x0F1cC0D35F4BFcf5815E32CE4b6D554020D92227";

function App() {
  const [status, setStatus] = useState("");
  const [wallet, setWallet] = useState("");
  const [keyPairs, setKeyPairs] = useState([]);
  const [publicKey, setpublicKey] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState("");
  const [userOpHash, setUserOpHash] = useState("");
  const [result, setResult] = useState("");

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const addressArray = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const obj = {
          status: "connected",
          address: addressArray[0],
        };
        return obj;
      } catch (err) {
        return {
          address: "",
          status: "😥 " + err.message,
        };
      }
    } else {
      return {
        address: "",
        status: "no metamask detected",
      };
    }
  };

  const connectWalletPressed = async () => {
    const walletResponse = await connectWallet();
    setStatus(walletResponse.status);
    setWallet(walletResponse.address);
  };

  const addKeyPair = async () => {
    // const { pubkey, secret } = createKeyPair();
    // // Add key pair to the list
    // setKeyPairs([...keyPairs, { pubkey, secret }]);

    try {
      const response = await axios.get("http://localhost:5001/api/keypair");
      console.log("response", response.data);
      const { pubKey, secKey } = response.data;
      console.log("pubKey", pubKey);
      setKeyPairs([...keyPairs, { pubKey, secKey }]);
      console.log("keyPairs", keyPairs);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const createWallet = async () => {
    try {
      const response = await axios.get("http://localhost:5001/api/wallet");
      console.log("response", response.data);
      setpublicKey(response.data.pubKey);
      setUserOpHash(response.data.userOpHash);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const signUserOp = async (index) => {
    try {
      const response = await axios.get(
        `http://localhost:5001/api/sign/${index}`
      );
      console.log("response", response.data);
      setKeyPairs((prevKeyPairs) => {
        const newKeyPairs = [...prevKeyPairs];
        newKeyPairs[index].signature = response.data.sig;
        return newKeyPairs;
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const aggregateSignatures = async () => {
    try {
      const response = await axios.get("http://localhost:5001/api/aggregate");
      console.log("response", response.data);
      setSignature(response.data.aggSig);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const verifyOnChain = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      blsverifyingAddress,
      BLSVERIFYINGABI.abi,
      signer
    );
    try {
      const res = await contract.BLS_DOMAIN();
      console.log("res", res);
      console.log("signature", signature, signature.length);
      console.log("publicKey", publicKey, publicKey.length);
      console.log("message", message, message.length);
      const result = await contract.verifyAndGreet(
        signature,
        publicKey,
        message
      );
      console.log("result", result);
      setResult(result.toString());
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  return (
    <div>
      <button onClick={connectWalletPressed}>Connect Wallet</button>
      <button onClick={addKeyPair}>Generate Key Pair</button>
      <ul>
        {keyPairs.map((keyPair, index) => (
          <li key={index}>
            User {index} <br />
            Public Key: {keyPair.pubKey} <br /> Private Key: {keyPair.secKey}
            <br />
            {userOpHash && (
              <button onClick={() => signUserOp(index)}>Sign userOp</button>
            )}
            {keyPair.signature && <p>Signature: {keyPair.signature}</p>}
          </li>
        ))}
      </ul>
      <button onClick={createWallet}>Create multi_sig wallet</button>
      <p>Aggregate PublicKey: {publicKey}</p>
      <p>UserOpHash: {userOpHash}</p>
      <button onClick={aggregateSignatures}>aggregte signatures</button>
      {signature && <p>Signature: {signature}</p>}
      <button onClick={verifyOnChain}>verify on chain</button>
      <p>{result}</p>
    </div>
  );
}

export default App;

// Compare this snippet from bls-frontend/src/App.js:
