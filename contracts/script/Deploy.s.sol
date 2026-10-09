// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PitchOracle} from "../src/PitchOracle.sol";
import {PitchsideRooms} from "../src/PitchsideRooms.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";

/// @notice Deploys the oracle and rooms.
/// env:
///   RELAYER_ADDRESS     relayer EOA (required)
///   CRE_FORWARDER       Chainlink KeystoneForwarder; defaults to RELAYER_ADDRESS (CRE-simulated mode)
///   AUSD_ADDRESS        stake token; if unset a MockAUSD is deployed (testnet only)
///   LOCK_DELAY_SECONDS  defaults to 8
///
/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract Deploy is Script {
    function run() external returns (PitchOracle oracle, PitchsideRooms rooms, address stakeToken) {
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address forwarder = vm.envOr("CRE_FORWARDER", relayer);
        uint64 lockDelay = uint64(vm.envOr("LOCK_DELAY_SECONDS", uint256(8)));
        stakeToken = vm.envOr("AUSD_ADDRESS", address(0));

        vm.startBroadcast();
        address deployer = msg.sender;
        if (stakeToken == address(0)) {
            require(block.chainid != 143, "Deploy: set AUSD_ADDRESS on mainnet");
            stakeToken = address(new MockAUSD());
        }
        oracle = new PitchOracle(deployer, relayer, forwarder, lockDelay);
        rooms = new PitchsideRooms(deployer, oracle, IERC20(stakeToken));
        vm.stopBroadcast();

        console2.log("chainId       ", block.chainid);
        console2.log("PitchOracle   ", address(oracle));
        console2.log("PitchsideRooms", address(rooms));
        console2.log("StakeToken    ", stakeToken);
        console2.log("Forwarder     ", forwarder);
    }
}
