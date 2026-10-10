// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {PositionListings} from "../src/PositionListings.sol";

contract PositionListingsTest is Fixture {
    PositionListings book;
    uint256 id;

    function setUp() public override {
        super.setUp();
        book = new PositionListings(market, token);
        id = _create();
        _buy(buyer, id, 6);
        vm.prank(buyer);
        market.setApprovalForAll(address(book), true);
        vm.prank(buyer2);
        token.approve(address(book), type(uint256).max);
    }

    function _list(uint128 units, uint128 price) internal returns (uint256) {
        vm.prank(buyer);
        return book.list(id, units, price, uint64(block.timestamp + 1 days));
    }

    function test_fillMovesPositionAndPayment() public {
        uint256 l = _list(4, uint128(15 * USD));
        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer2);
        book.fill(l, 3);
        assertEq(market.balanceOf(buyer2, id), 3);
        assertEq(market.balanceOf(buyer, id), 3);
        assertEq(token.balanceOf(buyer) - before, 45 * USD);
        assertEq(book.listing(l).filled, 3);
    }

    function test_claimRightMovesWithFill() public {
        uint256 l = _list(2, uint128(15 * USD));
        vm.prank(buyer2);
        book.fill(l, 2);
        _submit(id, 1, "inc");
        vm.warp(block.timestamp + CHALLENGE);
        market.finalize(id);
        uint256 before = token.balanceOf(buyer2);
        vm.prank(buyer2);
        market.claim(id);
        assertEq(token.balanceOf(buyer2) - before, 200 * USD);
    }

    function test_cannotOverfill() public {
        uint256 l = _list(2, uint128(15 * USD));
        vm.prank(buyer2);
        vm.expectRevert(abi.encodeWithSelector(PositionListings.TooMany.selector, uint128(2)));
        book.fill(l, 3);
    }

    function test_cancelledAndExpiredCannotFill() public {
        uint256 l = _list(2, uint128(15 * USD));
        vm.prank(buyer);
        book.cancel(l);
        vm.prank(buyer2);
        vm.expectRevert(PositionListings.NotLive.selector);
        book.fill(l, 1);

        uint256 l2 = _list(2, uint128(15 * USD));
        vm.warp(block.timestamp + 1 days);
        vm.prank(buyer2);
        vm.expectRevert(PositionListings.NotLive.selector);
        book.fill(l2, 1);
    }

    function test_staleListingFailsWhenSellerMovedUnits() public {
        uint256 l = _list(6, uint128(15 * USD));
        vm.prank(buyer);
        market.safeTransferFrom(buyer, owner, id, 5, "");
        vm.prank(buyer2);
        vm.expectRevert(PositionListings.SellerLacksUnits.selector);
        book.fill(l, 2);
    }

    function test_onlySellerCancels() public {
        uint256 l = _list(2, uint128(15 * USD));
        vm.prank(buyer2);
        vm.expectRevert(PositionListings.NotSeller.selector);
        book.cancel(l);
    }

    function test_listRequiresUnitsAndApproval() public {
        vm.prank(buyer);
        vm.expectRevert(PositionListings.SellerLacksUnits.selector);
        book.list(id, 7, uint128(15 * USD), uint64(block.timestamp + 1 days));
        vm.prank(buyer);
        market.setApprovalForAll(address(book), false);
        vm.prank(buyer);
        vm.expectRevert(PositionListings.NotApproved.selector);
        book.list(id, 1, uint128(15 * USD), uint64(block.timestamp + 1 days));
    }
}
