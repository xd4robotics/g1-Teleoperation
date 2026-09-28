#!/usr/bin/env python3
"""Small point-to-point TAP-over-UDP tunnel with frame fragmentation."""

import argparse
import fcntl
import os
from pathlib import Path
import selectors
import socket
import struct
import subprocess
import time

TUNSETIFF = 0x400454CA
IFF_TAP = 0x0002
IFF_NO_PI = 0x1000
MAGIC = b"G1L2"
HEADER = struct.Struct("!4sIHH")
CHUNK = 1200


def open_tap(name: str) -> int:
    fd = os.open("/dev/net/tun", os.O_RDWR | os.O_NONBLOCK)
    fcntl.ioctl(fd, TUNSETIFF, struct.pack("16sH", name.encode(), IFF_TAP | IFF_NO_PI))
    return fd


def main() -> None:
    parser = argparse.ArgumentParser()
    endpoint = parser.add_mutually_exclusive_group(required=True)
    endpoint.add_argument("--tap")
    endpoint.add_argument("--raw", help="Raw Ethernet interface (requires root)")
    parser.add_argument("--client-mac", help="Client MAC used for MAC-NAT on a raw endpoint")
    parser.add_argument("--local", required=True)
    parser.add_argument("--remote", required=True)
    parser.add_argument("--port", type=int, default=47892)
    parser.add_argument("--guard-interface", help="Exit when the local IP leaves this interface")
    parser.add_argument("--guard-wired", help="Exit when this wired interface gains carrier")
    parser.add_argument("--stats-interval", type=float, default=30.0)
    args = parser.parse_args()

    if args.tap:
        ethernet = open_tap(args.tap)
        read_frame = lambda: os.read(ethernet, 65535)
        write_frame = lambda frame: os.write(ethernet, frame)
        endpoint_name = args.tap
    else:
        raw = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3))
        raw.bind((args.raw, 0))
        raw.setsockopt(263, 23, 1)  # SOL_PACKET / PACKET_IGNORE_OUTGOING
        raw.setblocking(False)
        ethernet = raw
        wire_mac = raw.getsockname()[4]
        client_mac = bytes.fromhex(args.client_mac.replace(":", "")) if args.client_mac else None

        def read_frame() -> bytes:
            frame = bytearray(raw.recv(65535))
            if client_mac and frame[:6] == wire_mac:
                frame[:6] = client_mac
                if len(frame) >= 42 and frame[12:14] == b"\x08\x06" and frame[20:22] == b"\x00\x02":
                    frame[32:38] = client_mac
            return bytes(frame)

        def write_frame(frame: bytes) -> int:
            packet = bytearray(frame)
            if client_mac and packet[6:12] == client_mac:
                packet[6:12] = wire_mac
                if len(packet) >= 42 and packet[12:14] == b"\x08\x06":
                    packet[22:28] = wire_mac
            return raw.send(packet)

        endpoint_name = args.raw
    udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
    udp.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 4 * 1024 * 1024)
    udp.bind((args.local, args.port))
    udp.connect((args.remote, args.port))
    udp.setblocking(False)

    selector = selectors.DefaultSelector()
    selector.register(ethernet, selectors.EVENT_READ, "ethernet")
    selector.register(udp, selectors.EVENT_READ, "udp")
    frame_id = 0
    pending: dict[int, tuple[float, list[bytes | None]]] = {}
    tap_frames = udp_chunks = restored_frames = dropped_frames = 0
    next_report = time.monotonic() + args.stats_interval
    next_guard = time.monotonic() + 2

    print(f"TUNNEL_READY ethernet={endpoint_name} local={args.local} remote={args.remote}:{args.port}", flush=True)
    while True:
        if args.guard_interface and time.monotonic() >= next_guard:
            address = subprocess.run(["ip", "-4", "addr", "show", "dev", args.guard_interface], capture_output=True, text=True, check=False)
            carrier_file = f"/sys/class/net/{args.guard_wired}/carrier" if args.guard_wired else None
            wired_active = bool(carrier_file and Path(carrier_file).exists() and Path(carrier_file).read_text(encoding="ascii").strip() == "1")
            if f"inet {args.local}/" not in address.stdout or wired_active:
                print("TUNNEL_PAUSED local Wi-Fi IP changed or RJ45 connected", flush=True)
                return
            next_guard = time.monotonic() + 2
        for key, _ in selector.select(timeout=0.25):
            if key.data == "ethernet":
                frame = read_frame()
                tap_frames += 1
                frame_id = (frame_id + 1) & 0xFFFFFFFF
                total = (len(frame) + CHUNK - 1) // CHUNK
                for index in range(total):
                    payload = frame[index * CHUNK : (index + 1) * CHUNK]
                    try:
                        udp.send(HEADER.pack(MAGIC, frame_id, index, total) + payload)
                        udp_chunks += 1
                    except (BlockingIOError, ConnectionRefusedError):
                        # A saturated Wi-Fi send queue must not crash/restart
                        # the whole DDS tunnel. A partial frame expires at the
                        # receiver; record the loss for safety diagnostics.
                        dropped_frames += 1
                        break
            else:
                try:
                    packet = udp.recv(65535)
                except (BlockingIOError, ConnectionRefusedError):
                    continue
                if len(packet) < HEADER.size:
                    continue
                magic, incoming_id, index, total = HEADER.unpack_from(packet)
                if magic != MAGIC or total == 0 or index >= total or total > 64:
                    continue
                created, chunks = pending.setdefault(incoming_id, (time.monotonic(), [None] * total))
                if len(chunks) != total:
                    pending.pop(incoming_id, None)
                    continue
                chunks[index] = packet[HEADER.size:]
                if all(chunk is not None for chunk in chunks):
                    try:
                        write_frame(b"".join(chunks))
                        restored_frames += 1
                    except BlockingIOError:
                        dropped_frames += 1
                    pending.pop(incoming_id, None)

        cutoff = time.monotonic() - 2
        for stale_id in [item for item, (created, _) in pending.items() if created < cutoff]:
            pending.pop(stale_id, None)
        if args.stats_interval > 0 and time.monotonic() >= next_report:
            print(f"TUNNEL_STATS tap_tx={tap_frames} udp_tx={udp_chunks} tap_rx={restored_frames} pending={len(pending)} dropped={dropped_frames}", flush=True)
            next_report = time.monotonic() + args.stats_interval


if __name__ == "__main__":
    main()
