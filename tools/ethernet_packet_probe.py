#!/usr/bin/env python3
"""Brief read-only Ethernet frame summary; must run with CAP_NET_RAW."""

import socket
import struct
import time

sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3))
sock.bind(("eth0", 0))
sock.settimeout(1)
deadline = time.monotonic() + 12

while time.monotonic() < deadline:
    try:
        data = sock.recv(65535)
    except TimeoutError:
        continue
    ethertype = struct.unpack("!H", data[12:14])[0]
    if ethertype != 0x0806 and not (ethertype == 0x0800 and data[23] in (1, 17)):
        continue
    source = ":".join(f"{byte:02x}" for byte in data[6:12])
    destination = ":".join(f"{byte:02x}" for byte in data[:6])
    route = "ARP"
    if ethertype == 0x0800:
        route = f"{socket.inet_ntoa(data[26:30])}>{socket.inet_ntoa(data[30:34])}"
    print(source, destination, hex(ethertype), route, len(data), flush=True)
