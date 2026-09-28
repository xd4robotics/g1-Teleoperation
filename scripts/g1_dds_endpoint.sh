#!/usr/bin/env bash
set -euo pipefail
SIDE="${1:?notebook ou jetson}"
PROFILE_FILE="${2:?arquivo de perfil}"
PROFILE="$(<"$PROFILE_FILE")"
case "$PROFILE" in
    xd4) NOTEBOOK_IP=192.168.8.24; JETSON_IP=192.168.8.18 ;;
    robot) NOTEBOOK_IP=192.168.3.10; JETSON_IP=192.168.3.20 ;;
    *) echo "Perfil DDS inválido: $PROFILE" >&2; exit 2 ;;
esac
if [[ "$SIDE" == notebook ]]; then
    exec /usr/bin/python3 -u /home/xd4robotics/g1_teleoperation/tools/g1_l2_udp_tunnel.py --tap tap-g1 --local "$NOTEBOOK_IP" --remote "$JETSON_IP" --stats-interval 30
elif [[ "$SIDE" == jetson ]]; then
    exec /usr/bin/python3 -u /home/unitree/g1_l2_udp_tunnel.py --raw eth0 --client-mac 00:e0:4c:68:00:1a --local "$JETSON_IP" --remote "$NOTEBOOK_IP" --stats-interval 30
else
    echo "Lado DDS inválido: $SIDE" >&2; exit 2
fi
