// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ComputeMarket} from "../../src/ComputeMarket.sol";
import {CollateralVault} from "../../src/CollateralVault.sol";
import {OracleVerifier} from "../../src/OracleVerifier.sol";

/// @dev 6-decimal test token for local tests only. Testnet deployments use a real testnet stablecoin.
contract TestToken is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract Fixture is Test {
    uint256 internal constant USD = 1e6;
    uint32 internal constant POLICY = 1;
    uint32 internal constant CHALLENGE = 1 hours;
    uint32 internal constant RESOLVE = 1 days;

    TestToken internal token;
    CollateralVault internal vault;
    OracleVerifier internal oracle;
    ComputeMarket internal market;

    address internal owner = makeAddr("owner");
    address internal guardian = makeAddr("guardian");
    address internal seller = makeAddr("seller");
    address internal buyer = makeAddr("buyer");
    address internal buyer2 = makeAddr("buyer2");

    uint256[3] internal signerKeys;
    address[3] internal signers; // ascending

    function setUp() public virtual {
        token = new TestToken();
        vault = new CollateralVault(owner, token);
        oracle = new OracleVerifier(owner);
        market = new ComputeMarket(owner, vault, oracle, guardian);
        vm.startPrank(owner);
        vault.setMarket(address(market));
        oracle.setMarket(address(market));
        vm.stopPrank();

        _makeSigners();
        address[] memory s = new address[](3);
        for (uint256 i; i < 3; ++i) s[i] = signers[i];
        vm.prank(owner);
        oracle.createPolicy(
            POLICY,
            OracleVerifier.Policy({
                quorum: 2,
                signerCount: 0,
                challengeWindow: CHALLENGE,
                resolveWindow: RESOLVE,
                disputeBondBps: 1_000,
                minBond: uint128(10 * USD)
            }),
            s
        );

        _fund(seller, 100_000 * USD);
        _fund(buyer, 10_000 * USD);
        _fund(buyer2, 10_000 * USD);
        vm.prank(seller);
        vault.deposit(50_000 * USD);
    }

    function _makeSigners() internal {
        for (uint256 i; i < 3; ++i) {
            signerKeys[i] = uint256(keccak256(abi.encode("signer", i)));
            signers[i] = vm.addr(signerKeys[i]);
        }
        // sort ascending by address, keys alongside
        for (uint256 i; i < 3; ++i) {
            for (uint256 j = i + 1; j < 3; ++j) {
                if (signers[j] < signers[i]) {
                    (signers[i], signers[j]) = (signers[j], signers[i]);
                    (signerKeys[i], signerKeys[j]) = (signerKeys[j], signerKeys[i]);
                }
            }
        }
    }

    function _fund(address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.startPrank(who);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    /// 10 units × 100 USD payout, 10 USD premium per unit. M = 1,000 USD.
    function _terms() internal view returns (ComputeMarket.Terms memory t) {
        t = ComputeMarket.Terms({
            seller: seller,
            underlying: "H100-80GB-GPUh",
            quantity: 1_000,
            slaHash: keccak256("sla"),
            units: 10,
            payoutPerUnit: uint128(100 * USD),
            premiumPerUnit: uint128(10 * USD),
            feeBps: 0,
            saleEnd: uint64(block.timestamp + 1 days),
            deliveryDeadline: uint64(block.timestamp + 2 days),
            expiry: uint64(block.timestamp + 4 days),
            policyId: POLICY
        });
    }

    function _create() internal returns (uint256 id) {
        vm.prank(seller);
        id = market.create(_terms(), "ipfs://sla");
    }

    function _buy(address who, uint256 id, uint64 units) internal {
        vm.prank(who);
        market.buy(id, units, type(uint256).max);
    }

    function _report(uint256 id, uint8 outcome, bytes32 incidentId)
        internal
        view
        returns (OracleVerifier.IncidentReport memory r)
    {
        r = OracleVerifier.IncidentReport({
            contractId: id,
            incidentId: incidentId,
            outcome: outcome,
            evidenceHash: keccak256(abi.encode("evidence", incidentId)),
            observedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 hours)
        });
    }

    function _sign(OracleVerifier.IncidentReport memory r, uint256[] memory keys)
        internal
        view
        returns (bytes[] memory sigs)
    {
        bytes32 digest = oracle.hashReport(r);
        sigs = new bytes[](keys.length);
        for (uint256 i; i < keys.length; ++i) {
            (uint8 v, bytes32 rr, bytes32 ss) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(rr, ss, v);
        }
    }

    function _quorumKeys() internal view returns (uint256[] memory k) {
        k = new uint256[](2);
        k[0] = signerKeys[0];
        k[1] = signerKeys[1];
    }

    /// Warp past the delivery deadline and submit a 2-of-3 report.
    function _submit(uint256 id, uint8 outcome, bytes32 incidentId) internal {
        ComputeMarket.Terms memory t = market.terms(id);
        if (block.timestamp < t.deliveryDeadline) vm.warp(t.deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, outcome, incidentId);
        market.submitReport(r, _sign(r, _quorumKeys()));
    }

    function _assertReconciles() internal view {
        (bool ok, uint256 bal, uint256 tracked) = vault.reconcile();
        assertTrue(ok, "vault does not reconcile");
        assertEq(bal, tracked);
    }

    function _state(uint256 id) internal view returns (ComputeMarket.State) {
        return market.status(id).state;
    }
}
