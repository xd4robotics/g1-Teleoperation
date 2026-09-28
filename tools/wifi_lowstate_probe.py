#!/usr/bin/env python3
"""Read-only DDS probe for Unitree G1 low state over one interface."""

import argparse
import threading
import time

from unitree_sdk2py.core.channel import ChannelFactoryInitialize, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowState_


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("interface", help="Network interface used by Cyclone DDS")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--min-rate", type=float, default=0.0)
    parser.add_argument("--max-gap", type=float, default=0.0)
    args = parser.parse_args()

    received = threading.Event()
    sample_count = 0
    first_mode = None
    last_sample = None
    largest_gap = 0.0
    started = time.monotonic()

    def on_lowstate(message: LowState_) -> None:
        nonlocal sample_count, first_mode, last_sample, largest_gap
        now = time.monotonic()
        if last_sample is not None:
            largest_gap = max(largest_gap, now - last_sample)
        last_sample = now
        sample_count += 1
        if first_mode is None:
            first_mode = message.mode_machine
            received.set()

    ChannelFactoryInitialize(0, args.interface)
    subscriber = ChannelSubscriber("rt/lowstate", LowState_)
    subscriber.Init(on_lowstate, 10)

    deadline = started + args.timeout
    while time.monotonic() < deadline:
        time.sleep(0.1)

    if received.is_set():
        largest_gap = max(largest_gap, time.monotonic() - last_sample)
        rate = sample_count / max(time.monotonic() - started, 0.001)
        print(f"LOWSTATE_RECEIVED interface={args.interface} samples={sample_count} rate={rate:.1f}/s max_gap={largest_gap:.3f}s mode_machine={first_mode}")
        if rate < args.min_rate or (args.max_gap and largest_gap > args.max_gap):
            print("LOWSTATE_UNSTABLE")
            return 3
        return 0

    print(f"LOWSTATE_TIMEOUT interface={args.interface} timeout={args.timeout:.1f}s")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
