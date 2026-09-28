# Unitree G1 Teleoperation Station

Operator-facing control station used by XD4 Robotics to run XR arm and locomotion teleoperation on a Unitree G1. The React interface coordinates the existing `xr_teleoperate` Python application, the DDS-over-Wi-Fi tunnel, TeleImager, Vuer, and the camera path. It does not replace the Unitree SDK, arm controller, inverse kinematics, or robot firmware.

The current operating network is `xd4 main`. The alternate `robot` profile is not part of the normal operating procedure.

## Hardware and software

- Unitree G1 EDU, its remote controller, Jetson, and PC1 controller
- Meta Quest 3 with controllers or hand tracking enabled
- Operator notebook configured as `192.168.8.24` on `xd4 main`
- Jetson configured as `192.168.8.18` on Wi-Fi and `192.168.123.164` on `eth0`
- DJI Osmo Action camera connected to the Jetson through USB/UVC, when video is required
- Node.js 20 and npm; this workstation currently provides them under `.runtime/`
- Conda environment `tv` and Python at `/home/xd4robotics/miniconda3/envs/tv/bin/python`
- Modified `xr_teleoperate` checkout at `/home/xd4robotics/xr_teleoperate`
- SSH key access to `unitree@192.168.8.18`
- A narrowly scoped Jetson sudo rule for starting and stopping `video_hub_pc4`

The control repository does not contain the Unitree SDK, the modified `xr_teleoperate` checkout, the Conda environments, Jetson TeleImager configuration, certificates, SSH keys, or NetworkManager profiles. These must already be provisioned on the station and robot.

## Network and ports

| Component | Address or port | Purpose |
| --- | --- | --- |
| Operator notebook Wi-Fi | `192.168.8.24` | Frontend, API, Vuer, and local DDS relay |
| Jetson Wi-Fi (`wlan0`) | `192.168.8.18` | SSH, TeleImager, and robot-side relay |
| Notebook TAP (`tap-g1`) | `192.168.123.99` | DDS interface presented to the Unitree SDK |
| Jetson internal Ethernet (`eth0`) | `192.168.123.164` | Link to the G1 internal network |
| G1 PC1 | `192.168.123.161` | Robot DDS participant |
| React frontend | TCP `5173` | Operator interface |
| Backend/API | TCP `3001` | Orchestration, telemetry, and status |
| Vuer | TLS/WebSocket `8012` | Quest XR session and pose transport |
| TeleImager configuration | TCP `60000` | Camera configuration service |
| TeleImager WebRTC | TCP `60001` | H.264 camera signaling and stream |
| TeleImager ZMQ | TCP `55555` | Image client fallback/data path |

```text
Meta Quest 3
    | Vuer / WebSocket / WebRTC
    v
Notebook 192.168.8.24
    |-- React frontend :5173
    |-- Backend/API :3001
    |-- Vuer :8012
    |-- WebRTC proxy :60001
    |-- Python teleoperation
    `-- tap-g1 192.168.123.99
             |
             | Ethernet-over-UDP over xd4 main
             v
Jetson 192.168.8.18
    |-- eth0 192.168.123.164
    |-- TeleImager
    `-- DDS relay
             |
             v
G1 PC1 192.168.123.161
```

## Safety

- Keep the physical emergency stop and the G1 remote controller immediately accessible.
- Maintain clearance around the robot and use physical support appropriate for the planned operation.
- Do not select **Enable motion** unless DDS/lowstate is available, preparation completed, the Quest is connected, and valid XR poses are being received.
- Controlled arm movement can occur during **Prepare system** while the arm controller initializes. Abort if there is oscillation, repeated unexpected movement, unusual resistance, impact risk, or movement inconsistent with the normal preparation pose.
- **End session** is a software stop. It requests `CMD_STOP`, waits for the Python cleanup routine, and restores `video_hub_pc4` when the application had stopped it.
- The physical emergency stop is independent of the software stop and must be used whenever software control cannot safely end motion.
- The emergency script kills only the detached teleoperation process group. It deliberately skips the Python `go_home` cleanup and must be treated as an abnormal stop:

  ```bash
  cd /home/xd4robotics/g1_teleoperation
  ./scripts/emergency_teleop_abort.sh
  ```

This project is an engineering control application. The repository does not establish that the system is safety-certified.

## Normal operating procedure

### 1. Power on the Unitree G1

1. Place the robot in its supported operating fixture or safe standing area.
2. Keep people and obstacles outside the arm and walking envelope.
3. Power on the G1 using the manufacturer procedure.
4. Power on and retain the G1 remote controller.
5. Wait for the robot and its Jetson/PC1 computers to finish booting.

Do not start teleoperation while the robot is still booting or while the physical state is unstable.

### 2. Prepare the operator notebook

Power on or wake the operator notebook and connect it to `xd4 main`. Its expected address is `192.168.8.24`.

The deployed notebook starts the frontend, backend, and local DDS service automatically through enabled user-level systemd units. Normal operation does not require opening a terminal, entering the project directory, or manually starting `teleop_hand_and_arm.py`.

The notebook-to-G1 RJ45 cable should remain disconnected during normal wireless operation.

### 3. Connect all operator devices to `xd4 main`

Confirm that the following devices use the same network:

- notebook: `192.168.8.24`;
- Jetson: `192.168.8.18`;
- Meta Quest 3: DHCP address on `xd4 main`.

The Jetson internal `eth0`, the PC1 address, and `tap-g1` remain on `192.168.123.0/24`; they are not moved to the Wi-Fi subnet.

### 4. Wait for the automatic services

After the notebook and G1 are online on `xd4 main`, allow the automatic services to establish the local DDS relay, `tap-g1`, and the Jetson path. No terminal command is required during normal operation.

The operator verifies readiness from the web interface in step 7. The G1/Jetson and DDS indicators must report online/receiving before **Prepare system** is selected. If they do not, use the engineering recovery checks in the troubleshooting section instead of continuing.

### 5. Power on the Meta Quest 3

1. Power on the headset and controllers.
2. Confirm that hand tracking or both controllers are available for the selected mode.
3. Keep the headset awake during preparation.

### 6. Connect the Quest to the network

Connect the Quest to `xd4 main`. Internet access is not required for the local Vuer endpoint used by this project, but the Quest must be able to reach `192.168.8.24`.

### 7. Open the web interface

The application starts automatically when the notebook user session starts. On the notebook, open:

```text
http://192.168.8.24:5173/
```

Confirm that the interface reports the G1/Jetson online and lowstate data received. Camera and Vuer can remain unavailable until preparation.

If the page does not open, follow **Application does not start automatically** under troubleshooting. Do not manually start the Python teleoperation program.

### 8. Select the operating mode

The interface starts with **Hand Tracking** selected.

| UI mode | XR input | Arms | Locomotion |
| --- | --- | --- | --- |
| **Hand Tracking** | Quest hand tracking | Enabled after activation | Disabled |
| **Controllers** | Quest controllers | Enabled after activation | Disabled |
| **Full Control** | Quest controllers | Enabled after activation | Enabled after activation |

The current interface displays the third mode as **Controle completo** when running the Portuguese UI.

For **Full Control**, use the sequence documented by Unitree for G1 Regular mode before proceeding:

```text
L2 + B
L2 + Up
R1 + X
```

In the official Unitree `xr_teleoperate` motion guide, `L2+B` enters Damping mode, `L2+Up` enters Locked Standing, and `R1+X` enters the one-DoF-waist Regular mode supported by `--motion`. The current XD4 interface still displays `R1+Y`; treat that UI instruction as an unresolved documentation defect and follow the firmware-specific Unitree manual. Do not use `R1+Y` as the documented default unless Unitree confirms it for the exact firmware installed on the robot.

Do not press unrelated remote-controller combinations during application preparation.

### 9. Select **Prepare system**

Click **Preparar sistema** in the current UI. The backend performs the following sequence:

1. confirms SSH reachability to the Jetson at `192.168.8.18`;
2. probes lowstate on `tap-g1` and restarts only the notebook DDS relay if the first probe fails;
3. detects an available camera on the Jetson;
4. starts TeleImager when required, or continues with Quest pass-through if no camera is available;
5. starts one `teleop_hand_and_arm.py` process with IPC enabled;
6. passes `--img-server-ip=192.168.8.18`, `--webrtc-server-ip=192.168.8.24`, and `--network-interface=tap-g1`;
7. selects hand or controller XR input based on the UI mode;
8. adds `--motion` only for **Full Control**;
9. waits for DDS, IK, arm-controller, Vuer, and IPC initialization;
10. changes the session to the prepared state only after the Python process reports `READY`.

The backend rejects a second preparation while another session is preparing, ready, active, or stopping.

Some controlled arm movement during initialization is part of the current arm preparation routine. Immediately use the physical emergency stop or the emergency abort procedure if movement becomes abnormal as described in the safety section.

### 10. Connect the Quest to Vuer

In the Quest browser, open the local Vuer endpoint:

```text
https://192.168.8.24:8012/?ws=wss://192.168.8.24:8012&grid=False
```

Accept the locally served TLS certificate warning if the headset has not trusted it previously. Allow the browser permissions requested for WebXR, controller input, hand tracking, and immersive mode.

The web interface reports the Quest as connected when the Python/Vuer process logs an active WebSocket connection. Wait until **Quest / Vuer** reports ready before activation.

### 11. Select **Enable motion**

Confirm all of the following:

- preparation completed without an error;
- DDS/lowstate is still available;
- the correct operating mode is selected;
- the Quest WebSocket is connected;
- both required hands or controllers are tracked;
- the operator is ready and the physical emergency stop is accessible.

Click **Habilitar movimento**. The backend waits up to five seconds for valid XR motion data, then sends `CMD_START` to the Python IPC server. Robot following does not begin merely because the Quest WebSocket connected; valid XR poses are required.

### 12. Operate

In **Hand Tracking**, the two tracked hands drive the two robot arms. Locomotion is disabled.

In **Controllers**, the two Quest controllers drive the robot arms. Locomotion is disabled.

In **Full Control**, the controllers drive the arms and the analog sticks provide proportional locomotion commands:

| Quest input | Command range |
| --- | --- |
| Left stick vertical | backward `-0.3 m/s` to forward `+0.3 m/s` |
| Left stick horizontal | lateral `-0.5 m/s` to `+0.5 m/s` |
| Right stick horizontal | yaw `-1.0 rad/s` to `+1.0 rad/s` |

Each stick axis is clamped to `[-1, 1]`, maps proportionally to its command range, and produces exactly zero at a zero input. Pressing both analog sticks invokes Unitree `Damp()` as the implemented soft emergency action. This is not a substitute for the physical emergency stop.

### 13. End the session

Use **Encerrar sessão** in the interface before closing the browser or terminal. The backend sends `CMD_STOP`, waits for the teleoperation process to run its normal cleanup, stops the process group if cleanup exceeds its timeout, closes the camera process it started, restores `video_hub_pc4` when applicable, and returns the UI to idle.

After the session has returned to idle, close the browser, power down the Quest, and power down the G1 using the manufacturer procedure. The notebook application remains available for the next session and does not require an operator terminal.

## Camera path

The preferred deployed path is:

```text
DJI Osmo Action
  -> USB/UVC on Jetson
  -> OpenCV
  -> TeleImager
  -> WebRTC
  -> notebook and Quest
```

The target head-camera format is `1280x720` at `30 FPS`. During preparation, the backend checks the Jetson video devices, chooses the DJI or native camera profile, temporarily stops `video_hub_pc4` when TeleImager must own the device, starts TeleImager, and exposes the WebRTC signaling path through the notebook on port `60001`.

If no camera becomes available, preparation adds `--no-camera`; XR tracking continues in Quest pass-through mode. Missing video must not be interpreted as permission to ignore other readiness checks.

## DDS path

The G1 DDS traffic follows this path:

```text
PC1 192.168.123.161
  -> Jetson eth0 192.168.123.164
  -> Jetson Ethernet-over-UDP relay
  -> xd4 main
  -> notebook relay
  -> tap-g1 192.168.123.99
  -> Unitree SDK and teleoperation process
```

The tunnel preserves the internal DDS Ethernet domain across Wi-Fi. `g1_l2_udp_tunnel.py` handles the L2 transport; normal application operation must not change Unitree firmware or the internal SDK configuration.

Read-only engineering checks:

```bash
ip -4 addr show dev tap-g1
systemctl --user status g1-dds-wifi-local.service --no-pager
ssh unitree@192.168.8.18 'ip -4 addr show dev eth0; systemctl status g1-dds-wifi.service --no-pager'
ping -I tap-g1 -c 2 192.168.123.161
/home/xd4robotics/miniconda3/envs/tv/bin/python tools/wifi_lowstate_probe.py tap-g1 --timeout 6
```

The combined profile check is:

```bash
./scripts/wireless_profile_test.sh xd4
```

After preparation, include camera checks with:

```bash
./scripts/wireless_profile_test.sh xd4 --with-camera
```

## Troubleshooting

### Application does not start automatically

The deployed notebook has `g1-teleop-control.service` enabled as a user service. It calls `scripts/run_profile.sh` without an explicit argument; the script reads `xd4` from `~/.config/g1-wireless-dds-profile` and starts the backend and frontend together.

Check the installed service without starting the Python teleoperation process:

```bash
systemctl --user status g1-teleop-control.service --no-pager
cat ~/.config/g1-wireless-dds-profile
ss -ltn '( sport = :3001 or sport = :5173 )'
```

The profile must be `xd4`, the service must be active, and ports `3001` and `5173` must be listening. If the service is inactive, restart only the web application service:

```bash
systemctl --user restart g1-teleop-control.service
```

This starts the interface and API; it does not select **Prepare system** or activate robot motion.

### G1 or Jetson is offline

Check the notebook address and Jetson reachability:

```bash
ip -4 addr show dev wlp1s0
ping -I wlp1s0 -c 2 192.168.8.18
ssh unitree@192.168.8.18 'ip -4 addr show dev wlan0; ip -4 addr show dev eth0'
```

Expected addresses are `192.168.8.24`, `192.168.8.18`, and `192.168.123.164`, respectively.

### DDS or lowstate is unavailable

Do not activate motion. Check `tap-g1`, both relay services, PC1 ping, and the lowstate probe using the commands in the DDS section. Restart the verified tunnel path with:

```bash
./scripts/wireless_dds_stop.sh xd4
./scripts/wireless_dds_start.sh
./scripts/wireless_profile_test.sh xd4
```

### Quest does not connect

- Confirm that the Quest is on `xd4 main`.
- Open the complete local Vuer URL, including its `ws=` query parameter.
- Accept the local certificate warning.
- Keep the application terminal running.
- Check that Vuer port `8012` is listening after preparation.

```bash
ss -ltn '( sport = :8012 )'
```

### Camera is unavailable

Preparation can continue without video, but first check the Jetson services and ports without changing the camera configuration:

```bash
ssh unitree@192.168.8.18 'ss -ltn | grep -E ":(60000|60001|55555)\\b"'
```

Use the web interface event log for TeleImager startup errors. Do not change the DJI UVC device, format, or TeleImager configuration during an operating session.

### Preparation is already running

The backend deliberately permits only one teleoperation process. End the current session in the UI. For an abnormal or unresponsive process, use:

```bash
./scripts/emergency_teleop_abort.sh
```

Then inspect the event log and correct the underlying DDS, tracking, or process problem before trying again.

## Development checks

Install dependencies only when provisioning a new checkout:

```bash
npm ci
```

On the currently provisioned station, use its isolated Node.js runtime:

```bash
env PATH="$PWD/.runtime/bin:$PATH" npm run typecheck
env PATH="$PWD/.runtime/bin:$PATH" npm run build
```

The build output is intentionally excluded from Git.

## Configuration

Copy `.env.example` to `.env` only when local overrides are required:

```bash
cp .env.example .env
```

Do not commit `.env`, credentials, certificates, private keys, logs, runtime environments, generated builds, or local backup files. The checked-in `profiles/xd4.env` contains only non-secret network endpoints.

## Known repository constraints

- The service file installed on the operational notebook calls `scripts/run_profile.sh` without an argument and reads the persisted `xd4` profile from `~/.config/g1-wireless-dds-profile`. The service template stored under `scripts/` still contains an explicit `robot` argument and must not overwrite the deployed unit until that template is reviewed separately.
- The deployed UI currently displays `R1+Y`, while the official `xr_teleoperate` motion guide states `R1+X` for Regular mode. The README follows the official `R1+X` sequence; the UI discrepancy remains because this documentation-only change does not modify runtime behavior.
- Camera profile files and TLS material live on the Jetson and are not included in this repository.
- This repository has no license file. XD4 Robotics must select and approve a license before external distribution.

## Repository layout

```text
backend/       Express API, process orchestration, status, and telemetry
frontend/      React/Vite operator interface
profiles/      Runtime endpoint profiles
scripts/       DDS tunnel, profile launch, systemd examples, and emergency abort
tools/         DDS tunnel and diagnostic utilities
docs/          Legacy network notes; the current operator procedure is this README
```
