// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CollateralVault} from "../src/CollateralVault.sol";

/// @dev Reports success but moves nothing.
contract FalseToken is ERC20 {
    constructor() ERC20("False", "F") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return false;
    }
}

/// @dev USDT-style: transfer and transferFrom return nothing.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function approve(address s, uint256 a) external {
        allowance[msg.sender][s] = a;
    }

    function transfer(address to, uint256 a) external {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
    }

    function transferFrom(address f, address to, uint256 a) external {
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[to] += a;
    }
}

/// @dev Calls back into a target (the vault) from inside every transfer, then completes the transfer.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public payload;

    constructor() ERC20("Reenter", "R") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (target != address(0)) {
            address t = target;
            target = address(0); // one shot
            (bool ok, bytes memory ret) = t.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        super._update(from, to, value);
    }
}

/// @dev Takes a 1% fee on every transfer, so the receiver gets less than `amount`.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xFEE), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// @notice Token-failure behaviour of the vault, the only contract that moves tokens for the market.
///         Deployments fix the token at construction, so these cover what happens if a bad token is ever used.
contract MaliciousTokenTest is Test {
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function _vault(address token) internal returns (CollateralVault v) {
        v = new CollateralVault(owner, IERC20(token));
    }

    function test_falseReturningTokenRevertsAndCreditsNothing() public {
        FalseToken t = new FalseToken();
        CollateralVault v = _vault(address(t));
        t.mint(alice, 1_000e6);
        vm.startPrank(alice);
        t.approve(address(v), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(t)));
        v.deposit(100e6);
        vm.stopPrank();
        assertEq(v.free(alice), 0);
        (bool ok,,) = v.reconcile();
        assertTrue(ok);
    }

    function test_noReturnTokenWorksBothWays() public {
        NoReturnToken t = new NoReturnToken();
        CollateralVault v = _vault(address(t));
        t.mint(alice, 1_000e6);
        vm.startPrank(alice);
        t.approve(address(v), type(uint256).max);
        v.deposit(100e6);
        v.withdraw(40e6);
        vm.stopPrank();
        assertEq(v.free(alice), 60e6);
        assertEq(t.balanceOf(alice), 940e6);
        (bool ok,,) = v.reconcile();
        assertTrue(ok);
    }

    function test_reentrantWithdrawIsBlocked() public {
        ReentrantToken t = new ReentrantToken();
        CollateralVault v = _vault(address(t));
        t.mint(alice, 1_000e6);
        vm.startPrank(alice);
        t.approve(address(v), type(uint256).max);
        v.deposit(100e6);
        vm.stopPrank();

        // during the payout transfer, try to withdraw the same free balance a second time
        t.arm(address(v), abi.encodeCall(CollateralVault.withdraw, (100e6)));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        v.withdraw(100e6);

        assertEq(v.free(alice), 100e6);
        assertEq(t.balanceOf(alice), 900e6);
        (bool ok,,) = v.reconcile();
        assertTrue(ok);
    }

    function test_reentrantDepositIsBlocked() public {
        ReentrantToken t = new ReentrantToken();
        CollateralVault v = _vault(address(t));
        t.mint(alice, 1_000e6);
        vm.prank(alice);
        t.approve(address(v), type(uint256).max);

        t.arm(address(v), abi.encodeCall(CollateralVault.deposit, (100e6)));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        v.deposit(100e6);
        assertEq(v.free(alice), 0);
    }

    /// @dev Fee-on-transfer tokens are not supported: the vault credits the requested amount. The mismatch is not
    ///      silent: reconcile() reports it, which is the check the web app shows and the demo scripts assert.
    function test_feeOnTransferIsDetectedByReconcile() public {
        FeeToken t = new FeeToken();
        CollateralVault v = _vault(address(t));
        t.mint(alice, 1_000e6);
        vm.startPrank(alice);
        t.approve(address(v), type(uint256).max);
        v.deposit(100e6);
        vm.stopPrank();
        (bool ok, uint256 balance, uint256 tracked) = v.reconcile();
        assertFalse(ok);
        assertEq(balance, 99e6);
        assertEq(tracked, 100e6);
    }
}
