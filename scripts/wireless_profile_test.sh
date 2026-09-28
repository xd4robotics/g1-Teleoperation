#!/usr/bin/env bash
# Offline, read-only validation after the tunnel is started. No robot motion.
set -euo pipefail
PROFILE="${1:-robot}"
CAMERA_CHECK="${2:-}"
if [[ -n "$CAMERA_CHECK" && "$CAMERA_CHECK" != "--with-camera" ]]; then
    echo "Uso: $0 {xd4|robot} [--with-camera]" >&2
    exit 2
fi
case "$PROFILE" in
    xd4) LOCAL_IP=192.168.8.24; JETSON_IP=192.168.8.18 ;;
    robot) LOCAL_IP=192.168.3.10; JETSON_IP=192.168.3.20 ;;
    *) echo "Uso: $0 {xd4|robot}" >&2; exit 2 ;;
esac
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON=/home/xd4robotics/miniconda3/envs/tv/bin/python
fail=0
check() { if "$@"; then echo "OK: $*"; else echo "FALHA: $*"; fail=1; fi; }
check bash -c "ip -4 addr show dev wlp1s0 | grep -Fq 'inet $LOCAL_IP/'"
check ping -I wlp1s0 -c 2 -W 1 "$JETSON_IP"
check bash -c "ip -4 addr show dev tap-g1 | grep -Fq 'inet 192.168.123.99/' && test \"\$(cat /sys/class/net/tap-g1/operstate)\" = up"
check systemctl --user is-active --quiet g1-dds-wifi-local.service
check ssh -o BatchMode=yes -o ConnectTimeout=3 "unitree@$JETSON_IP" "systemctl is-active --quiet g1-dds-wifi.service && ip -4 addr show dev eth0 | grep -Fq 'inet 192.168.123.164/'"
check ping -I tap-g1 -c 2 -W 1 192.168.123.161
check "$PYTHON" "$PROJECT_DIR/tools/wifi_lowstate_probe.py" tap-g1 --timeout 6
if [[ "$CAMERA_CHECK" == "--with-camera" ]]; then
    check bash -c "timeout 3 bash -c 'exec 3<>/dev/tcp/$JETSON_IP/60000'"
    check bash -c "timeout 3 bash -c 'exec 3<>/dev/tcp/$JETSON_IP/60001' || timeout 3 bash -c 'exec 3<>/dev/tcp/$JETSON_IP/55555'"
    check bash -c "timeout 3 bash -c 'exec 3<>/dev/tcp/$LOCAL_IP/60001'"
else
    echo "Câmera: verifique após Preparar sistema com --with-camera."
fi
check bash -c "timeout 3 bash -c 'exec 3<>/dev/tcp/127.0.0.1/3001'"
exit "$fail"
