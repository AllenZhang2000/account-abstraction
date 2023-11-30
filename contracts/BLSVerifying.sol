//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import {BLSOpen} from "./bls/lib/BLSOpen.sol";
import "./bls/BLSHelper.sol";

import "hardhat/console.sol";

/**
 * A BLS-based signature aggregator, to validate aggregated signature of multiple UserOps if BLSAccount
 */
contract BLSVerifying {
    bytes32 public constant BLS_DOMAIN = keccak256("eip4337.bls.domain");

    //copied from BLS.sol
    uint256 public constant N =
        21888242871839275222246405745257275088696311157297823662689037894645226208583;

    uint256 constant FIELD_MASK =
        0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant SIGN_MASK =
        0x8000000000000000000000000000000000000000000000000000000000000000;
    uint256 constant ODD_NUM =
        0x8000000000000000000000000000000000000000000000000000000000000000;

    // Negated genarator of G2
    uint256 constant nG2x1 =
        11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant nG2x0 =
        10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant nG2y1 =
        17805874995975841540914202342111839520379459829704422454583296818431106115052;
    uint256 constant nG2y0 =
        13392588948715843804641432497768002650278120570034223513918757245338268106653;

    /**
     * return the trailing 4 words of input data
     */
    function getTrailingPublicKey(
        bytes memory data
    ) public pure returns (uint256[4] memory publicKey) {
        uint len = data.length;
        require(len > 32 * 4, "data too short for sig");

        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            // actual buffer starts at data+32, so last 128 bytes start at data+32+len-128 = data+len-96
            let ofs := sub(add(data, len), 96)
            mstore(publicKey, mload(ofs))
            mstore(add(publicKey, 32), mload(add(ofs, 32)))
            mstore(add(publicKey, 64), mload(add(ofs, 64)))
            mstore(add(publicKey, 96), mload(add(ofs, 96)))
        }
    }

    function _getPublicKeyHash(
        uint256[4] memory publicKey
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(publicKey));
    }

    function validateUserOpSignature1(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external view returns (bool) {
        return BLSOpen.verifySingle(signature, pubkey, message);
    }

    function validateUserOpSignature2(
        bytes calldata _signature,
        bytes calldata _pubkey,
        bytes calldata _message
    ) external view returns (bool) {
        uint256[2] memory signature = abi.decode(_signature, (uint256[2]));
        uint256[4] memory pubkey = abi.decode(_pubkey, (uint256[4]));
        uint256[2] memory message = abi.decode(_message, (uint256[2]));

        console.log("signature: %s", signature[0]);
        console.log("signature: %s", signature[1]);

        return BLSOpen.verifySingle(signature, pubkey, message);
    }

    function bytesToBytes32(bytes memory _data) public pure returns (bytes32) {
        require(_data.length <= 32, "Data cannot be longer than 32 bytes");
        bytes32 result;
        assembly {
            result := mload(add(_data, 32))
        }
        return result;
    }

    function compareBytes(
        bytes memory a,
        bytes memory b
    ) public pure returns (bool) {
        if (a.length != b.length) {
            return false;
        }

        for (uint i = 0; i < a.length; i++) {
            if (a[i] != b[i]) {
                return false;
            }
        }

        return true;
    }

    function validateUserOpSignature3(
        bytes calldata _signature,
        bytes calldata _pubkey,
        bytes calldata _message,
        bytes calldata _messageHash,
        bytes calldata _domain
    ) external view returns (bool) {
        uint256[2] memory signature = abi.decode(_signature, (uint256[2]));
        uint256[4] memory pubkey = abi.decode(_pubkey, (uint256[4]));
        uint256[2] memory message = BLSOpen.hashToPoint(BLS_DOMAIN, _message);
        uint256[2] memory messageHash = abi.decode(_messageHash, (uint256[2]));

        if (
            compareBytes(
                abi.encodePacked(BLSOpen.hashToPoint(BLS_DOMAIN, _message)),
                abi.encodePacked(
                    BLSOpen.hashToPoint(bytesToBytes32(_domain), _message)
                )
            )
        ) console.log("equal");
        else console.log("not equal");

        console.log("messgaHash 0: %s", messageHash[0]);
        console.log("message 0: %s", message[0]);
        console.log("messgaHash 1: %s", messageHash[1]);
        console.log("message 1: %s", message[1]);

        bool first = BLSOpen.verifySingle(signature, pubkey, message);
        bool second = BLSOpen.verifySingle(signature, pubkey, messageHash);
        console.log("first: %s", first);
        console.log("second: %s", second);
        return first && second;
    }

    function hashToPoint(
        bytes memory domain,
        bytes memory message
    ) public view returns (uint256[2] memory) {
        return BLSOpen.hashToPoint(bytesToBytes32(domain), message);
    }

    function validateMultipleUserOpSignature(
        uint256[2] memory signature,
        uint256[4][] memory pubkeys,
        uint256[2][] memory messages
    ) external view returns (bool) {
        return BLSOpen.verifyMultiple(signature, pubkeys, messages);
    }
}
