#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-xd4}"
case "$PROFILE" in
    xd4) JETSON_IP=192.168.8.18 ;;
    robot) JETSON_IP=192.168.3.20 ;;
    *) echo "Uso: $0 {xd4|robot}" >&2; exit 2 ;;
esac

systemctl --user stop g1-dds-wifi-local.service 2>/dev/null || true

echo "Parando o relay no G1; o sudo remoto poderá solicitar a senha."
ssh -tt "unitree@$JETSON_IP" "sudo systemctl stop g1-dds-wifi.service" || true
nmcli connection down G1-WiFi-TAP >/dev/null 2>&1 || true
echo "DDS wireless parado. O perfil Ethernet G1 permanece preservado."
