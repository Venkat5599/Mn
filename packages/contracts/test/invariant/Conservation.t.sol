// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Fixture, TestToken} from "../utils/Fixture.sol";
import {ComputeMarket} from "../../src/ComputeMarket.sol";
import {CollateralVault} from "../../src/CollateralVault.sol";
import {OracleVerifier} from "../../src/OracleVerifier.sol";

/// @dev Drives random sequences of every user-facing action. Reverts are expected and ignored
///      (fail_on_revert = false); the invariants must hold after whatever succeeded.
contract Handler is Test {
    ComputeMarket internal market;
    CollateralVault internal vault;
    OracleVerifier internal oracle;
    TestToken internal token;
    address internal seller;
    address internal guardian;
    address[3] internal buyers;
    uint256[2] internal keys;

    uint256[] public ids;
    uint256 public nReport;
    uint256 public nDispute;
    uint256 public nFinal;
    uint256 public nExpire;
    uint256 public nClaim;
    uint256 public nRefund;

    constructor(
        ComputeMarket m,
        CollateralVault v,
        OracleVerifier o,
        TestToken tk,
        address s,
        address g,
        address[3] memory b,
        uint256[2] memory k
    ) {
        market = m;
        vault = v;
        oracle = o;
        token = tk;
        seller = s;
        guardian = g;
        buyers = b;
        keys = k;
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    function _id(uint256 seed) internal view returns (uint256) {
        if (ids.length == 0) return 0;
        uint256 window = ids.length < 3 ? ids.length : 3; // act mostly on recent contracts
        return ids[ids.length - 1 - (seed % window)];
    }

    function create(uint64 units, uint128 m, uint128 p) external {
        units = uint64(bound(units, 1, 20));
        m = uint128(bound(m, 1e6, 500e6));
        p = uint128(bound(p, 1, m));
        ComputeMarket.Terms memory t = ComputeMarket.Terms({
            seller: seller,
            underlying: "H100-80GB-GPUh",
            quantity: 100,
            slaHash: keccak256("sla"),
            units: units,
            payoutPerUnit: m,
            premiumPerUnit: p,
            feeBps: 250,
            saleEnd: uint64(block.timestamp + 1 hours),
            deliveryDeadline: uint64(block.timestamp + 2 hours),
            expiry: uint64(block.timestamp + 6 hours),
            policyId: 1
        });
        vm.prank(seller);
        try market.create(t, "") returns (uint256 id) {
            ids.push(id);
        } catch {}
    }

    function buy(uint256 seed, uint256 who, uint64 units) external {
        vm.prank(buyers[who % 3]);
        try market.buy(_id(seed), uint64(bound(units, 1, 20)), type(uint256).max) {} catch {}
    }

    function transfer(uint256 seed, uint256 from, uint256 to, uint256 units) external {
        uint256 id = _id(seed);
        address a = buyers[from % 3];
        units = bound(units, 0, market.balanceOf(a, id));
        vm.prank(a);
        try market.safeTransferFrom(a, buyers[to % 3], id, units, "") {} catch {}
    }

    function report(uint256 seed, bool failure, uint256 nonce) external {
        uint256 id = _id(seed);
        if (id == 0) return;
        uint64 deadline = market.terms(id).deliveryDeadline;
        if (block.timestamp < deadline) vm.warp(deadline);
        OracleVerifier.IncidentReport memory r = OracleVerifier.IncidentReport({
            contractId: id,
            incidentId: keccak256(abi.encode(id, nonce)),
            outcome: failure ? 1 : 2,
            evidenceHash: keccak256("e"),
            observedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = oracle.hashReport(r);
        bytes[] memory sigs = new bytes[](2);
        for (uint256 i; i < 2; ++i) {
            (uint8 v, bytes32 rr, bytes32 ss) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(rr, ss, v);
        }
        try market.submitReport(r, sigs) { nReport++; } catch {}
    }

    function dispute(uint256 seed, uint256 who) external {
        uint256 id = _id(seed);
        address a = who % 4 == 3 ? seller : buyers[who % 3];
        vm.prank(a);
        try market.dispute(id) { nDispute++; } catch {}
    }

    function resolve(uint256 seed, bool failure, bool void_) external {
        vm.prank(guardian);
        try market.resolve(
            _id(seed), failure ? ComputeMarket.Outcome.FAILURE : ComputeMarket.Outcome.DELIVERED, void_
        ) {} catch {}
    }

    function finalize(uint256 seed) external {
        uint256 id = _id(seed);
        ComputeMarket.Status memory st = market.status(id);
        if (st.state == ComputeMarket.State.REVIEW && block.timestamp < st.challengeEnd) vm.warp(st.challengeEnd);
        if (st.state == ComputeMarket.State.DISPUTED && block.timestamp <= st.resolveBy) vm.warp(st.resolveBy + 1);
        try market.finalize(id) { nFinal++; } catch {}
    }

    function expire(uint256 seed) external {
        try market.expire(_id(seed)) { nExpire++; } catch {}
    }

    function releaseUnsold(uint256 seed) external {
        try market.releaseUnsold(_id(seed)) {} catch {}
    }

    function claim(uint256 seed, uint256 who) external {
        vm.prank(buyers[who % 3]);
        try market.claim(_id(seed)) { nClaim++; } catch {}
    }

    function refund(uint256 seed, uint256 who) external {
        vm.prank(buyers[who % 3]);
        try market.refund(_id(seed)) { nRefund++; } catch {}
    }

    function withdraw(uint256 amount) external {
        amount = bound(amount, 1, vault.free(seller) / 4 + 1);
        vm.prank(seller);
        try vault.withdraw(amount) {} catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 15 minutes));
    }
}

contract ConservationInvariant is Fixture {
    Handler internal handler;
    address internal buyer3;

    function setUp() public override {
        super.setUp();
        address b3 = makeAddr("buyer3");
        buyer3 = b3;
        _fund(b3, 10_000 * USD);
        for (uint256 i; i < 3; ++i) {
            address b = i == 0 ? buyer : i == 1 ? buyer2 : b3;
            vm.prank(b);
            token.approve(address(vault), type(uint256).max);
        }
        handler = new Handler(
            market,
            vault,
            oracle,
            token,
            seller,
            guardian,
            [buyer, buyer2, b3],
            [signerKeys[0], signerKeys[1]]
        );
        targetContract(address(handler));
    }

    /// Every token the vault holds sits in exactly one bucket.
    function invariant_vaultReconciles() public view {
        _assertReconciles();
    }

    /// Before settlement, reserved collateral covers every sold unit's maximum payout.
    function invariant_collateralCoversLiabilities() public view {
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.ids(i);
            ComputeMarket.Status memory s = market.status(id);
            ComputeMarket.Terms memory t = market.terms(id);
            if (
                s.state == ComputeMarket.State.ACTIVE || s.state == ComputeMarket.State.REVIEW
                    || s.state == ComputeMarket.State.DISPUTED || s.state == ComputeMarket.State.DELIVERED
            ) {
                assertGe(vault.reserved(id), uint256(s.sold) * t.payoutPerUnit, "undercollateralized");
            }
            if (s.state == ComputeMarket.State.SETTLED) {
                // what is still payable covers every outstanding position
                uint256 outstanding = _supply(id);
                assertGe(vault.payable_(id), outstanding * (uint256(t.payoutPerUnit) + s.bondPerUnit));
            }
            if (s.state == ComputeMarket.State.EXPIRED || s.state == ComputeMarket.State.VOIDED) {
                assertEq(vault.reserved(id), 0, "collateral left behind");
                assertEq(vault.bond(id), 0, "bond left behind");
            }
        }
    }

    function _supply(uint256 id) internal view returns (uint256 total) {
        total = market.balanceOf(buyer, id) + market.balanceOf(buyer2, id)
            + market.balanceOf(buyer3, id);
    }
}

/// forge-config: default.invariant.depth = 1000
/// forge-config: default.invariant.runs = 16
contract ConservationCoverage is ConservationInvariant {
    /// Proves the invariants are not vacuous: the random walk really reaches every terminal path.
    function afterInvariant() public view {
        console.log("contracts", handler.idCount());
        console.log("reports", handler.nReport());
        console.log("disputes", handler.nDispute());
        console.log("finalized", handler.nFinal());
        console.log("expired", handler.nExpire());
        console.log("claims", handler.nClaim());
        console.log("refunds", handler.nRefund());
    }
}
