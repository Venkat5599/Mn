// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "./utils/Fixture.sol";
import {PriceProtectionPool} from "../src/PriceProtectionPool.sol";

contract PriceProtectionPoolTest is Test {
    bytes32 constant FEED = keccak256("MON/USD");
    uint256 constant USD = 1e6;

    TestToken token;
    PriceProtectionPool pool;
    uint256[3] keys;
    address[] signers;
    address lp = makeAddr("lp");
    address buyer = makeAddr("buyer");

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new TestToken();
        for (uint256 i; i < 3; ++i) keys[i] = uint256(keccak256(abi.encode("price-signer", i)));
        // ascending by address
        for (uint256 i; i < 3; ++i) {
            for (uint256 j = i + 1; j < 3; ++j) {
                if (vm.addr(keys[j]) < vm.addr(keys[i])) (keys[i], keys[j]) = (keys[j], keys[i]);
            }
        }
        for (uint256 i; i < 3; ++i) signers.push(vm.addr(keys[i]));
        pool = new PriceProtectionPool(address(this), token, FEED, signers, 2, 800);

        token.mint(lp, 100_000 * USD);
        token.mint(buyer, 10_000 * USD);
        vm.prank(lp);
        token.approve(address(pool), type(uint256).max);
        vm.prank(buyer);
        token.approve(address(pool), type(uint256).max);
        vm.prank(lp);
        pool.deposit(10_000 * USD);
    }

    function _report(int64 price, uint64 t) internal view returns (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) {
        r = PriceProtectionPool.PriceReport({feedId: FEED, price: price, publishTime: t});
        bytes32 d = pool.hashPrice(r);
        sigs = new bytes[](2);
        for (uint256 i; i < 2; ++i) {
            (uint8 v, bytes32 a, bytes32 b) = vm.sign(keys[i], d);
            sigs[i] = abi.encodePacked(a, b, v);
        }
    }

    function _buy(uint128 notional, uint16 strikeBps, uint8 dur) internal returns (uint256 id) {
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_500_000, uint64(block.timestamp));
        vm.prank(buyer);
        id = pool.buy(notional, strikeBps, dur, type(uint256).max, r, sigs);
    }

    function test_payoutBelowStrike() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 0); // spot 0.025, strike 0.02375
        vm.warp(block.timestamp + 1 hours);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_000_000, uint64(block.timestamp));
        uint256 before = token.balanceOf(buyer);
        pool.settle(id, r, sigs);
        // 1000 × (0.02375 − 0.02) / 0.025 = 150
        assertEq(token.balanceOf(buyer) - before, 150 * USD);
        assertEq(pool.locked(), 0);
    }

    function test_noPayoutAboveStrike() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 0);
        vm.warp(block.timestamp + 1 hours);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_400_000, uint64(block.timestamp));
        uint256 before = token.balanceOf(buyer);
        pool.settle(id, r, sigs);
        assertEq(token.balanceOf(buyer), before);
        assertEq(pool.position(id).paid, 0);
    }

    function test_payoutCappedAtMaxWhenPriceGoesToZero() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_000, 0);
        vm.warp(block.timestamp + 1 hours);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(0, uint64(block.timestamp));
        uint256 before = token.balanceOf(buyer);
        pool.settle(id, r, sigs);
        assertEq(token.balanceOf(buyer) - before, 900 * USD);
    }

    function test_premiumRisesWithUtilizationAndDuration() public view {
        (uint256 small,) = pool.quote(uint128(100 * USD), 9_500, 2);
        (uint256 big,) = pool.quote(uint128(8_000 * USD), 9_500, 2);
        assertGt(big * 100 / 8_000, small * 100 / 100, "rate per unit rises with utilization");
        (uint256 oneHour,) = pool.quote(uint128(100 * USD), 9_500, 0);
        assertGt(small, oneHour, "longer protection costs more");
        (uint256 deepOtm,) = pool.quote(uint128(100 * USD), 8_000, 2);
        assertLt(deepOtm, small, "further out of the money costs less");
    }

    function test_cannotSellMoreThanPool() public {
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_500_000, uint64(block.timestamp));
        vm.prank(buyer);
        vm.expectRevert();
        pool.buy(uint128(20_000 * USD), 9_500, 0, type(uint256).max, r, sigs);
    }

    function test_lpCannotWithdrawLocked() public {
        _buy(uint128(5_000 * USD), 9_500, 2);
        uint256 all = pool.shares(lp);
        vm.prank(lp);
        vm.expectRevert();
        pool.withdraw(all);
    }

    function test_lpEarnsPremium() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 2);
        vm.warp(block.timestamp + 24 hours);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_600_000, uint64(block.timestamp));
        pool.settle(id, r, sigs);
        uint256 all = pool.shares(lp);
        uint256 before = token.balanceOf(lp);
        vm.prank(lp);
        pool.withdraw(all);
        assertGt(token.balanceOf(lp) - before, 10_000 * USD, "LP got deposit plus premium");
    }

    function test_rejectsStaleBuyPrice() public {
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_500_000, uint64(block.timestamp - 121));
        vm.prank(buyer);
        vm.expectRevert(PriceProtectionPool.StalePrice.selector);
        pool.buy(uint128(100 * USD), 9_500, 0, type(uint256).max, r, sigs);
    }

    function test_rejectsSettlePriceOutsideWindow() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 0);
        uint64 expiry = pool.position(id).expiry;
        vm.warp(expiry + 700);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(1_000_000, uint64(block.timestamp));
        vm.expectRevert(PriceProtectionPool.PriceOutsideWindow.selector);
        pool.settle(id, r, sigs);
        (r, sigs) = _report(1_000_000, expiry - 1);
        vm.expectRevert(PriceProtectionPool.PriceOutsideWindow.selector);
        pool.settle(id, r, sigs);
    }

    function test_rejectsUnauthorizedAndBelowQuorum() public {
        PriceProtectionPool.PriceReport memory r =
            PriceProtectionPool.PriceReport({feedId: FEED, price: 2_500_000, publishTime: uint64(block.timestamp)});
        bytes32 d = pool.hashPrice(r);
        bytes[] memory one = new bytes[](1);
        (uint8 v, bytes32 a, bytes32 b) = vm.sign(keys[0], d);
        one[0] = abi.encodePacked(a, b, v);
        vm.prank(buyer);
        vm.expectRevert(PriceProtectionPool.QuorumNotMet.selector);
        pool.buy(uint128(100 * USD), 9_500, 0, type(uint256).max, r, one);

        bytes[] memory bad = new bytes[](2);
        bad[0] = one[0];
        (v, a, b) = vm.sign(uint256(keccak256("attacker")), d);
        bad[1] = abi.encodePacked(a, b, v);
        vm.prank(buyer);
        vm.expectRevert();
        pool.buy(uint128(100 * USD), 9_500, 0, type(uint256).max, r, bad);
    }

    function test_cannotSettleTwiceOrEarly() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 0);
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(2_000_000, uint64(block.timestamp));
        vm.expectRevert(PriceProtectionPool.NotExpired.selector);
        pool.settle(id, r, sigs);
        vm.warp(block.timestamp + 1 hours);
        (r, sigs) = _report(2_000_000, uint64(block.timestamp));
        pool.settle(id, r, sigs);
        vm.expectRevert(PriceProtectionPool.AlreadySettled.selector);
        pool.settle(id, r, sigs);
    }

    function test_missingPriceLapsesWithoutPayout() public {
        uint256 id = _buy(uint128(1_000 * USD), 9_500, 0);
        vm.warp(block.timestamp + 1 hours + 1 days + 1);
        uint256 before = token.balanceOf(buyer);
        pool.lapse(id);
        assertEq(token.balanceOf(buyer), before);
        assertEq(pool.locked(), 0);
    }

    function testFuzz_solvency(uint128 notional, int64 price, uint8 dur) public {
        notional = uint128(bound(notional, 1 * USD, 9_000 * USD));
        price = int64(bound(price, 0, 10_000_000));
        dur = uint8(bound(dur, 0, 2));
        uint256 id = _buy(notional, 9_000, dur);
        assertGe(pool.assets(), pool.locked(), "pool always covers locked payouts");
        vm.warp(block.timestamp + pool.duration(dur));
        (PriceProtectionPool.PriceReport memory r, bytes[] memory sigs) = _report(price, uint64(block.timestamp));
        pool.settle(id, r, sigs);
        assertLe(pool.position(id).paid, pool.position(id).maxPayout);
        assertEq(pool.locked(), 0);
    }
}
