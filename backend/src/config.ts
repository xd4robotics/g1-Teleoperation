import 'dotenv/config';
const number = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
export const config = {
  port: number('PORT', 3001), frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  g1Host: process.env.G1_HOST ?? '192.168.8.18', g1User: process.env.G1_USER ?? 'unitree',
  networkInterface: process.env.G1_NETWORK_INTERFACE ?? 'tap-g1',
  ddsProbePath: process.env.G1_DDS_PROBE_PATH ?? '/home/xd4robotics/g1_teleoperation/tools/wifi_lowstate_probe.py',
  teleopPath: process.env.TELEOP_PATH ?? '/home/xd4robotics/xr_teleoperate/teleop',
  condaPath: process.env.CONDA_PATH ?? '/home/xd4robotics/miniconda3/bin/conda', condaEnv: process.env.CONDA_ENV ?? 'tv',
  pythonPath: process.env.PYTHON_PATH ?? '/home/xd4robotics/miniconda3/envs/tv/bin/python',
  vuerPort: number('VUER_PORT', 8012), configPort: number('TELEIMAGER_CONFIG_PORT', 60000), zmqPort: number('TELEIMAGER_ZMQ_PORT', 55555),
  webrtcPort: number('TELEIMAGER_WEBRTC_PORT', 60001),
  webrtcProxyHost: process.env.WEBRTC_PROXY_HOST ?? '192.168.8.24',
  cameraStartupTimeoutMs: number('CAMERA_STARTUP_TIMEOUT_MS', 60000),
  teleimagerPath: process.env.G1_TELEIMAGER_PATH ?? '/home/unitree/teleimager',
  sshKey: process.env.SSH_PRIVATE_KEY ?? '/home/xd4robotics/.ssh/id_ed25519'
};
