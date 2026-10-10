// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {ComputeMarket} from "../src/ComputeMarket.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {OracleVerifier} from "../src/OracleVerifier.sol";

contract ComputeMarketTest is Fixture {
    uint8 constant FAILURE = 1;
    uint8 constant DELIVERED = 2;

    // ───────────────────────────── happy paths ─────────────────────────────

    function test_failurePaysBuyersAndSellerKeepsPremium() public {
        uint256 id = _create();
        _buy(buyer, id, 6);
        _buy(buyer2, id, 4);
        _submit(id, FAILURE, "inc-1");
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.REVIEW));

        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.SETTLED));

        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        market.claim(id);
        assertEq(token.balanceOf(buyer) - before, 600 * USD);
        vm.prank(buyer2);
        market.claim(id);

        // seller: 50,000 deposited - 1,000 paid out + 100 premium
        assertEq(vault.free(seller), 50_000 * USD - 1_000 * USD + 100 * USD);
        assertEq(vault.reserved(id), 0);
        assertEq(vault.payable_(id), 0);
        _assertReconciles();
    }

    function test_deliveredReleasesOnlyAtExpiry() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, DELIVERED, "inc-1");
        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.DELIVERED));
        assertEq(vault.reserved(id), 1_000 * USD, "still locked before expiry");

        vm.expectRevert();
        market.expire(id);

        vm.warp(market.terms(id).expiry);
        market.expire(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.EXPIRED));
        assertEq(vault.free(seller), 50_000 * USD + 100 * USD);
        _assertReconciles();
    }

    function test_partialSaleReleasesUnsoldThenSettles() public {
        uint256 id = _create();
        _buy(buyer, id, 3);
        vm.warp(market.terms(id).saleEnd);
        market.releaseUnsold(id);
        assertEq(vault.reserved(id), 300 * USD);
        _submit(id, FAILURE, "inc-1");
        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
        vm.prank(buyer);
        market.claim(id);
        assertEq(vault.free(seller), 50_000 * USD - 300 * USD + 30 * USD);
        _assertReconciles();
    }

    function test_nothingSoldExpiresAtSaleEnd() public {
        uint256 id = _create();
        vm.warp(market.terms(id).saleEnd);
        market.releaseUnsold(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.EXPIRED));
        assertEq(vault.free(seller), 50_000 * USD);
    }

    function test_feeIsExplicitAndGoesToFees() public {
        ComputeMarket.Terms memory t = _terms();
        t.feeBps = 500;
        vm.prank(seller);
        uint256 id = market.create(t, "");
        _buy(buyer, id, 10);
        _submit(id, DELIVERED, "inc-1");
        vm.warp(t.expiry);
        market.finalize(id);
        assertEq(vault.fees(), 5 * USD);
        assertEq(vault.free(seller), 50_000 * USD + 95 * USD);
        _assertReconciles();
    }

    // ───────────────────────────── 1. collateral locked while obligated ─────────────────────────────

    function test_sellerCannotWithdrawReserved() public {
        _create();
        uint256 freeBal = vault.free(seller);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.Insufficient.selector, freeBal, freeBal + 1));
        vault.withdraw(freeBal + 1);
    }

    // ───────────────────────────── 2. no double claim ─────────────────────────────

    function test_cannotClaimTwice() public {
        uint256 id = _settledFailure();
        vm.prank(buyer);
        market.claim(id);
        vm.prank(buyer);
        vm.expectRevert(ComputeMarket.NothingToRedeem.selector);
        market.claim(id);
    }

    // ───────────────────────────── 3. unauthorized oracle ─────────────────────────────

    function test_rejectsUnauthorizedSigner() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        uint256[] memory keys = new uint256[](2);
        keys[0] = signerKeys[0];
        keys[1] = uint256(keccak256("attacker"));
        bytes[] memory sigs = _sign(r, keys);
        vm.expectRevert(); // ascending or unauthorized, both rejected
        market.submitReport(r, sigs);
    }

    function test_rejectsBelowQuorum() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        uint256[] memory keys = new uint256[](1);
        keys[0] = signerKeys[0];
        bytes[] memory sigs = _sign(r, keys);
        vm.expectRevert(abi.encodeWithSelector(OracleVerifier.QuorumNotMet.selector, 1, 2));
        market.submitReport(r, sigs);
    }

    function test_rejectsDuplicateSignerSignature() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        uint256[] memory keys = new uint256[](2);
        keys[0] = signerKeys[0];
        keys[1] = signerKeys[0];
        bytes[] memory sigs = _sign(r, keys);
        vm.expectRevert(OracleVerifier.SignersNotAscending.selector);
        market.submitReport(r, sigs);
    }

    function test_rejectsRevokedSigner() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.prank(owner);
        oracle.revokeSigner(POLICY, signers[1]);
        vm.warp(market.terms(id).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.expectRevert(abi.encodeWithSelector(OracleVerifier.UnauthorizedSigner.selector, signers[1]));
        market.submitReport(r, sigs);
    }

    function test_reportBoundToContractAndChain() public {
        uint256 a = _create();
        uint256 b = _create();
        _buy(buyer, a, 1);
        _buy(buyer, b, 1);
        vm.warp(market.terms(a).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(a, FAILURE, "inc-1");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        r.contractId = b; // signatures were for contract a
        vm.expectRevert();
        market.submitReport(r, sigs);

        // same report on another chain id: digest changes, signers do not recover
        OracleVerifier.IncidentReport memory r2 = _report(a, FAILURE, "inc-2");
        bytes[] memory sigs2 = _sign(r2, _quorumKeys());
        vm.chainId(999);
        vm.expectRevert();
        market.submitReport(r2, sigs2);
    }

    // ───────────────────────────── 4. stale report ─────────────────────────────

    function test_rejectsReportPastValidUntil() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).deliveryDeadline);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.warp(r.validUntil + 1);
        vm.expectRevert(ComputeMarket.ReportExpired.selector);
        market.submitReport(r, sigs);
    }

    function test_rejectsObservationBeforeDeadline() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).deliveryDeadline - 1);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.expectRevert(ComputeMarket.ObservedTooEarly.selector);
        market.submitReport(r, sigs);
    }

    // ───────────────────────────── 5. duplicate report ─────────────────────────────

    function test_firstReportFixesOutcome() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        _submit(id, DELIVERED, "inc-1");
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-2");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.expectRevert(abi.encodeWithSelector(ComputeMarket.WrongState.selector, ComputeMarket.State.REVIEW));
        market.submitReport(r, sigs);
    }

    function test_incidentIdCannotBeReplayedAcrossContracts() public {
        uint256 a = _create();
        uint256 b = _create();
        _buy(buyer, a, 1);
        _buy(buyer, b, 1);
        _submit(a, FAILURE, "same");
        OracleVerifier.IncidentReport memory r = _report(b, FAILURE, "same");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.expectRevert(abi.encodeWithSelector(OracleVerifier.IncidentReplayed.selector, bytes32("same")));
        market.submitReport(r, sigs);
    }

    // ───────────────────────────── 6. claim window ─────────────────────────────

    function test_rejectsReportAfterExpiry() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        vm.warp(market.terms(id).expiry + 1);
        OracleVerifier.IncidentReport memory r = _report(id, FAILURE, "inc-1");
        bytes[] memory sigs = _sign(r, _quorumKeys());
        vm.expectRevert(ComputeMarket.ReportExpired.selector);
        market.submitReport(r, sigs);
    }

    function test_disputeOnlyInsideChallengeWindow() public {
        uint256 id = _create();
        _buy(buyer, id, 1);
        _submit(id, FAILURE, "inc-1");
        vm.warp(block.timestamp + CHALLENGE);
        vm.prank(seller);
        vm.expectRevert(ComputeMarket.ChallengeClosed.selector);
        market.dispute(id);
    }

    // ───────────────────────────── 7. obligation above collateral ─────────────────────────────

    function test_cannotCreateBeyondFreeCollateral() public {
        ComputeMarket.Terms memory t = _terms();
        t.units = 1_000; // M = 100,000 > 50,000 free
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.Insufficient.selector, 50_000 * USD, 100_000 * USD)
        );
        market.create(t, "");
    }

    function test_onlySellerCanCreateForThemselves() public {
        vm.prank(buyer);
        vm.expectRevert(ComputeMarket.NotSeller.selector);
        market.create(_terms(), "");
    }

    function test_rejectsBadTerms() public {
        ComputeMarket.Terms memory t = _terms();
        t.deliveryDeadline = t.expiry;
        vm.prank(seller);
        vm.expectRevert(ComputeMarket.BadTerms.selector);
        market.create(t, "");
    }

    // ───────────────────────────── 8. transfer failure ─────────────────────────────

    function test_buyWithoutAllowanceRevertsCleanly() public {
        uint256 id = _create();
        address poor = makeAddr("poor");
        vm.prank(poor);
        vm.expectRevert();
        market.buy(id, 1, type(uint256).max);
        assertEq(market.status(id).sold, 0);
        _assertReconciles();
    }

    // ───────────────────────────── 9 / 10. voids, refunds, outages ─────────────────────────────

    function test_outageNeverPaysOut() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        vm.warp(market.terms(id).expiry + 1);
        market.expire(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.EXPIRED));
        assertEq(market.balanceOf(buyer, id), 10); // position worthless, nothing claimable
        vm.prank(buyer);
        vm.expectRevert();
        market.claim(id);
        _assertReconciles();
    }

    function test_guardianVoidRefundsPremiumOnce() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id);
        vm.prank(guardian);
        market.resolve(id, ComputeMarket.Outcome.NONE, true);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.VOIDED));

        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        market.refund(id);
        assertEq(token.balanceOf(buyer) - before, 100 * USD);
        vm.prank(buyer);
        vm.expectRevert(ComputeMarket.NothingToRedeem.selector);
        market.refund(id);
        assertEq(vault.free(seller), 50_000 * USD); // bond back (good-faith void), collateral back
        _assertReconciles();
    }

    // ───────────────────────────── 11 / 12. sale limits ─────────────────────────────

    function test_cannotOversell() public {
        uint256 id = _create();
        _buy(buyer, id, 8);
        vm.prank(buyer2);
        vm.expectRevert(abi.encodeWithSelector(ComputeMarket.SoldOut.selector, 2));
        market.buy(id, 3, type(uint256).max);
    }

    function test_cannotBuyAfterSaleEnd() public {
        uint256 id = _create();
        vm.warp(market.terms(id).saleEnd);
        vm.prank(buyer);
        vm.expectRevert(ComputeMarket.SaleClosed.selector);
        market.buy(id, 1, type(uint256).max);
    }

    function test_slippageGuard() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ComputeMarket.PremiumTooHigh.selector, 20 * USD, 19 * USD));
        market.buy(id, 2, 19 * USD);
    }

    // ───────────────────────────── 13–17. dispute bond ─────────────────────────────

    function test_sellerBondMustComeFromFreeNotReserved() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        uint256 freeBal = vault.free(seller);
        vm.prank(seller);
        vault.withdraw(freeBal); // free = 0, reserved still 1,000
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.Insufficient.selector, 0, 100 * USD));
        market.dispute(id);
        assertEq(vault.reserved(id), 1_000 * USD);
    }

    function test_frivolousSellerDisputeSlashedToBuyers() public {
        uint256 id = _create();
        _buy(buyer, id, 6);
        _buy(buyer2, id, 4);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id); // bond = 10% of 1,000 = 100
        vm.prank(guardian);
        market.resolve(id, ComputeMarket.Outcome.FAILURE, false);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.SETTLED));
        assertEq(market.status(id).bondPerUnit, 10 * USD);

        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        market.claim(id);
        assertEq(token.balanceOf(buyer) - before, 6 * (100 + 10) * USD);
        vm.prank(buyer2);
        market.claim(id);
        // seller paid 1,000 payout and lost the 100 bond, kept the 100 premium
        assertEq(vault.free(seller), 50_000 * USD - 1_000 * USD - 100 * USD + 100 * USD);
        _assertReconciles();
    }

    function test_guardianTimeoutVoidsAndStillSlashes() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id);
        vm.warp(market.status(id).resolveBy + 1);
        vm.prank(guardian);
        vm.expectRevert(ComputeMarket.ResolveClosed.selector);
        market.resolve(id, ComputeMarket.Outcome.FAILURE, false);

        market.finalize(id);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.VOIDED));
        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        market.refund(id);
        assertEq(token.balanceOf(buyer) - before, 100 * USD + 100 * USD, "premium + slashed bond");
        assertEq(vault.free(seller), 50_000 * USD - 100 * USD, "seller lost the bond");
        _assertReconciles();
    }

    function test_sellerWinsDisputeGetsBondBack() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id);
        vm.prank(guardian);
        market.resolve(id, ComputeMarket.Outcome.DELIVERED, false);
        assertEq(uint8(_state(id)), uint8(ComputeMarket.State.DELIVERED));
        vm.warp(market.terms(id).expiry);
        market.expire(id);
        assertEq(vault.free(seller), 50_000 * USD + 100 * USD);
        _assertReconciles();
    }

    function test_holderDisputesDeliveredAndLosesBondToSeller() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, DELIVERED, "inc-1");
        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        market.dispute(id);
        assertEq(before - token.balanceOf(buyer), 100 * USD);
        vm.prank(guardian);
        market.resolve(id, ComputeMarket.Outcome.DELIVERED, false);
        vm.warp(market.terms(id).expiry);
        market.expire(id);
        assertEq(vault.free(seller), 50_000 * USD + 100 * USD + 100 * USD, "premium + slashed holder bond");
        _assertReconciles();
    }

    function test_sellerCannotDisputeDelivered() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, DELIVERED, "inc-1");
        vm.prank(seller);
        vm.expectRevert(ComputeMarket.NotHolder.selector);
        market.dispute(id);
    }

    function test_onlyOneDispute() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(ComputeMarket.WrongState.selector, ComputeMarket.State.DISPUTED));
        market.dispute(id);
    }

    function test_onlyGuardianResolves() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.prank(seller);
        market.dispute(id);
        vm.prank(seller);
        vm.expectRevert(ComputeMarket.NotGuardian.selector);
        market.resolve(id, ComputeMarket.Outcome.DELIVERED, false);
    }

    function test_bondFloorAppliesToSmallContracts() public {
        ComputeMarket.Terms memory t = _terms();
        t.units = 1;
        t.payoutPerUnit = uint128(20 * USD); // 10% would be 2 USD, floor is 10
        vm.prank(seller);
        uint256 id = market.create(t, "");
        assertEq(market.disputeBond(id), 10 * USD);
    }

    // ───────────────────────────── positions ─────────────────────────────

    function test_claimRightFollowsTransfer() public {
        uint256 id = _create();
        _buy(buyer, id, 10);
        vm.prank(buyer);
        market.safeTransferFrom(buyer, buyer2, id, 4, "");
        _submit(id, FAILURE, "inc-1");
        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
        uint256 before = token.balanceOf(buyer2);
        vm.prank(buyer2);
        market.claim(id);
        assertEq(token.balanceOf(buyer2) - before, 400 * USD);
        vm.prank(buyer);
        market.claim(id);
        _assertReconciles();
    }

    // ───────────────────────────── fuzz ─────────────────────────────

    function testFuzz_settlementConserves(uint64 sold, uint8 path, uint16 feeBps) public {
        sold = uint64(bound(sold, 1, 10));
        feeBps = uint16(bound(feeBps, 0, 1_000));
        ComputeMarket.Terms memory t = _terms();
        t.feeBps = feeBps;
        vm.prank(seller);
        uint256 id = market.create(t, "");
        _buy(buyer, id, sold);
        path = uint8(bound(path, 0, 3));
        if (path == 0) {
            _submit(id, FAILURE, "x");
            vm.warp(block.timestamp + CHALLENGE);
            market.finalize(id);
            vm.prank(buyer);
            market.claim(id);
        } else if (path == 1) {
            _submit(id, DELIVERED, "x");
            vm.warp(t.expiry);
            market.finalize(id);
        } else if (path == 2) {
            _submit(id, FAILURE, "x");
            vm.prank(seller);
            market.dispute(id);
            vm.warp(block.timestamp + RESOLVE + 1);
            market.finalize(id);
            vm.prank(buyer);
            market.refund(id);
        } else {
            vm.warp(t.expiry + 1);
            market.expire(id);
        }
        _assertReconciles();
        assertEq(vault.reserved(id), 0);
        assertEq(vault.payable_(id), 0);
        assertEq(vault.bond(id), 0);
    }

    function _settledFailure() internal returns (uint256 id) {
        id = _create();
        _buy(buyer, id, 10);
        _submit(id, FAILURE, "inc-1");
        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
    }
}
