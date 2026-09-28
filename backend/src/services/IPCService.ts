import { spawn } from 'node:child_process';
import { config } from '../config.js';

const clientCode = `
import json
import sys
import time
from utils.ipc import IPC_Client
client = IPC_Client(hb_fps=10.0)
try:
    deadline = time.monotonic() + 3.0
    while not client.is_online() and time.monotonic() < deadline:
        time.sleep(0.05)
    result = client.send_data(sys.argv[1])
    print(json.dumps(result))
    if result.get("status") != "ok": raise SystemExit(2)
finally:
    client.stop()
`;

export class IPCService {
  waitForReady(timeoutMs=15000): Promise<void> {
    const stateCode = `
import sys
import time
from utils.ipc import IPC_Client
client = IPC_Client(hb_fps=10.0)
try:
    deadline = time.monotonic() + float(sys.argv[1]) / 1000.0
    while time.monotonic() < deadline:
        state = client.latest_state() if client.is_online() else {}
        if state and state.get("READY", False):
            raise SystemExit(0)
        time.sleep(0.05)
    print("O controlador do G1 não concluiu a inicialização.", file=sys.stderr)
    raise SystemExit(2)
finally:
    client.stop()
`;
    return new Promise((resolve,reject)=>{
      const child=spawn(config.pythonPath,['-c',stateCode,String(timeoutMs)],{cwd:config.teleopPath,env:{...process.env,PYTHONUNBUFFERED:'1'},stdio:['ignore','ignore','pipe']});
      let stderr='';child.stderr.on('data',data=>stderr+=data);child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error(stderr.trim()||'Controlador do G1 não ficou pronto')));
    });
  }
  waitForMotion(timeoutMs=5000): Promise<void> {
    const stateCode = `
import sys
import time
from utils.ipc import IPC_Client
client = IPC_Client(hb_fps=10.0)
try:
    deadline = time.monotonic() + float(sys.argv[1]) / 1000.0
    while time.monotonic() < deadline:
        if client.is_online() and client.latest_state().get("MOTION_DATA_READY", False):
            raise SystemExit(0)
        time.sleep(0.05)
    print("O Quest está conectado, mas ainda não enviou poses válidas das duas mãos/controles.", file=sys.stderr)
    raise SystemExit(2)
finally:
    client.stop()
`;
    return new Promise((resolve,reject)=>{
      const child=spawn(config.pythonPath,['-c',stateCode,String(timeoutMs)],{cwd:config.teleopPath,env:{...process.env,PYTHONUNBUFFERED:'1'},stdio:['ignore','ignore','pipe']});
      let stderr='';child.stderr.on('data',data=>stderr+=data);child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error(stderr.trim()||'Poses do Quest ainda não estão disponíveis')));
    });
  }
  send(command: 'CMD_START' | 'CMD_STOP'): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(config.pythonPath, ['-c', clientCode, command], { cwd: config.teleopPath, env: { ...process.env, PYTHONUNBUFFERED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`Comando IPC ${command} falhou: ${stderr || stdout || `código ${code}`}`)));
    });
  }
}
