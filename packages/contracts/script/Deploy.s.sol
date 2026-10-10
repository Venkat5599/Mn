// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestUSD} from "../src/TestUSD.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {OracleVerifier} from "../src/OracleVerifier.sol";
import {ComputeMarket} from "../src/ComputeMarket.sol";

/// @notice Deploys the full market and evidence policy 1 (2-of-3 signers), then writes
///         deployments/<chainId>.json for the oracle and the web app.
/// env: DEPLOYER_PRIVATE_KEY, SIGNER_1_ADDRESS, SIGNER_2_ADDRESS, SIGNER_3_ADDRESS
contract Deploy is Script {
    uint32 constant POLICY_ID = 1;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address[] memory signers = _sorted(
            vm.envAddress("SIGNER_1_ADDRESS"), vm.envAddress("SIGNER_2_ADDRESS"), vm.envAddress("SIGNER_3_ADDRESS")
        );
        uint256 startBlock = block.number;

        vm.startBroadcast(pk);
        TestUSD token = new TestUSD();
        CollateralVault vault = new CollateralVault(deployer, IERC20(address(token)));
        OracleVerifier oracle = new OracleVerifier(deployer);
        ComputeMarket market = new ComputeMarket(deployer, vault, oracle, deployer);
        vault.setMarket(address(market));
        oracle.setMarket(address(market));
        oracle.createPolicy(
            POLICY_ID,
            OracleVerifier.Policy({
                quorum: 2,
                signerCount: 0,
                challengeWindow: 5 minutes,
                resolveWindow: 30 minutes,
                disputeBondBps: 1_000,
                minBond: 10e6
            }),
            signers
        );
        vm.stopBroadcast();

        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "token", address(token));
        vm.serializeBool(o, "tokenIsTestOnly", true);
        vm.serializeAddress(o, "vault", address(vault));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "market", address(market));
        vm.serializeUint(o, "policyId", POLICY_ID);
        string memory json = vm.serializeUint(o, "startBlock", startBlock);
        string memory path = string.concat(vm.projectRoot(), "/../../deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("deployment written to", path);
    }

    function _sorted(address a, address b, address c) internal pure returns (address[] memory s) {
        s = new address[](3);
        (s[0], s[1], s[2]) = (a, b, c);
        for (uint256 i; i < 3; ++i) {
            for (uint256 j = i + 1; j < 3; ++j) {
                if (s[j] < s[i]) (s[i], s[j]) = (s[j], s[i]);
            }
        }
    }
}
