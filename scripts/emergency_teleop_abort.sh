#!/usr/bin/env bash
# Emergency abort: terminate only the detached teleop process group, without
# invoking Python cleanup/go_home or any robot motion command.
set -euo pipefail
found=0
while read -r pid; do
    [[ -n "$pid" ]] || continue
    cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
    [[ "$cmd" == /home/xd4robotics/miniconda3/envs/tv/bin/python\ -u\ teleop_hand_and_arm.py* ]] || continue
    pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
    if [[ "$pgid" == "$pid" ]]; then
        kill -KILL -- "-$pgid"
        echo "ABORTADO: grupo de teleoperação $pgid encerrado sem rotina go_home."
    else
        kill -KILL "$pid"
        echo "ABORTADO: processo de teleoperação $pid encerrado sem rotina go_home."
    fi
    found=1
done < <(pgrep -f '^/home/xd4robotics/miniconda3/envs/tv/bin/python -u teleop_hand_and_arm.py' || true)
if (( ! found )); then echo 'Nenhum processo de teleoperação ativo.'; fi
