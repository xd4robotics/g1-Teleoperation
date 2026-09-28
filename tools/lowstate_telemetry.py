#!/usr/bin/env python3
"""One-shot, read-only G1 telemetry snapshot from rt/lowstate."""
import argparse
import json
import math
import threading

from unitree_sdk2py.core.channel import ChannelFactoryInitialize, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowState_, BmsState_


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("interface")
    parser.add_argument("--timeout", type=float, default=2.0)
    args = parser.parse_args()
    received = threading.Event()
    battery_received = threading.Event()
    snapshot = {}

    def on_lowstate(message: LowState_):
        if received.is_set():
            return
        temperatures = []
        for motor in message.motor_state[:29]:
            for value in motor.temperature:
                if isinstance(value, (int, float)) and math.isfinite(value) and 0 < value < 150:
                    temperatures.append(int(value))
        snapshot.update({
            "lowstate": True,
            "modeMachine": int(message.mode_machine),
            "motorTemperatureMaxC": max(temperatures) if temperatures else None,
        })
        received.set()

    def on_battery(message: BmsState_):
        value = int(message.soc)
        if 0 <= value <= 100:
            snapshot["batteryPercent"] = value
            battery_received.set()

    ChannelFactoryInitialize(0, args.interface)
    ChannelSubscriber("rt/lowstate", LowState_).Init(on_lowstate, 10)
    ChannelSubscriber("rt/lf/bmsstate", BmsState_).Init(on_battery, 10)
    received.wait(args.timeout)
    if received.is_set():
        battery_received.wait(min(args.timeout, 1.0))
    snapshot.setdefault("batteryPercent", None)
    print(json.dumps(snapshot if received.is_set() else {
        "lowstate": False, "modeMachine": None,
        "motorTemperatureMaxC": None, "batteryPercent": None,
    }))


if __name__ == "__main__":
    main()
