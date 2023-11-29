import React, { useState } from "react";
import axios from "axios";

function App() {
  const [keyPairs, setKeyPairs] = useState([]);
  const [signatures, setSignatures] = useState([]); // [ { sig: "0x...", pubKey: "0x..." }
  const [wallet, setWallet] = useState("");
  const [userOpHash, setUserOpHash] = useState("");

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
      setWallet(response.data.pubKey);
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
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  return (
    <div>
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
      <p>Wallet: {wallet}</p>
      <p>UserOpHash: {userOpHash}</p>
    </div>
  );
}

export default App;

// Compare this snippet from bls-frontend/src/App.js:
