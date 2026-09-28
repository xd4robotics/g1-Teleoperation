#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/g1-wireless-dds"
LOG_FILE="$RUNTIME_DIR/tunnel.log"
WIRED_IFACE="enx00e04c68001a"

if [[ -r "/sys/class/net/$WIRED_IFACE/carrier" ]] && [[ "$(<"/sys/class/net/$WIRED_IFACE/carrier")" == "1" ]]; then
    echo "ERRO: desconecte fisicamente o cabo Ethernet antes de iniciar o DDS wireless." >&2
    exit 2
fi

mkdir -p "$RUNTIME_DIR"
nmcli connection up G1-WiFi-TAP >/dev/null

echo "Iniciando o relay no G1; o sudo remoto solicitará a senha sem armazená-la."
ssh -tt unitree@192.168.8.18 \
    "sudo systemctl stop g1-dds-wifi.service 2>/dev/null || true; sudo systemd-run --unit=g1-dds-wifi --collect --property=Restart=on-failure --property=RestartSec=2 /usr/bin/python3 -u /home/unitree/g1_l2_udp_tunnel.py --raw eth0 --client-mac 00:e0:4c:68:00:1a --local 192.168.8.18 --remote 192.168.8.24 --stats-interval 30"

systemctl --user stop g1-dds-wifi-local.service 2>/dev/null || true
systemd-run --user --unit=g1-dds-wifi-local --collect \
    --property=Restart=on-failure --property=RestartSec=2 \
    --property=StandardOutput="append:$LOG_FILE" --property=StandardError="append:$LOG_FILE" \
    python3 -u "$PROJECT_DIR/tools/g1_l2_udp_tunnel.py" \
    --tap tap-g1 --local 192.168.8.24 --remote 192.168.8.18 --stats-interval 30 \
    >/dev/null

sleep 2
if [[ "$(systemctl --user is-active g1-dds-wifi-local.service 2>/dev/null)" != "active" ]]; then
    echo "ERRO: relay local encerrou. Consulte $LOG_FILE" >&2
    exit 3
fi

echo "DDS wireless ativo. Use --network-interface=tap-g1 e --img-server-ip=192.168.8.18."
