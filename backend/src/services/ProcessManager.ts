import { ChildProcess, spawn } from 'node:child_process';
import type { LogEntry } from '../types.js';
export class ProcessManager {
  private processes = new Map<string, ChildProcess>();
  constructor(private log: (entry: LogEntry) => void) {}
  start(name: string, command: string, args: string[], cwd: string, env = process.env) {
    if (this.isRunning(name)) throw new Error(`${name} já está em execução`);
    const child = spawn(command, args, { cwd, env, stdio: ['pipe','pipe','pipe'], detached: true });
    this.processes.set(name, child);
    const forward = (level: 'info'|'error') => (data: Buffer) => this.log({time:new Date().toISOString(),source:name as 'teleop',level,message:data.toString().trimEnd()});
    child.stdout?.on('data', forward('info')); child.stderr?.on('data', forward('error'));
    child.on('error', e => forward('error')(Buffer.from(e.message)));
    child.on('close', code => { this.processes.delete(name); this.log({time:new Date().toISOString(),source:name as 'teleop',level:code === 0 ? 'info':'error',message:`Processo encerrado (código ${code ?? 'sinal'})`}); });
    return child;
  }
  get(name: string) { return this.processes.get(name); }
  isRunning(name: string) { const p=this.get(name); return Boolean(p && p.exitCode === null && !p.killed); }
  input(name: string, value: string) { const p=this.get(name); if (!p?.stdin?.writable) throw new Error(`${name} não aceita comandos`); p.stdin.write(value); }
  signal(name: string, signal: NodeJS.Signals) { const p=this.get(name); if (p) this.signalGroup(p, signal); }
  private waitForClose(p: ChildProcess, timeout: number) { return new Promise<boolean>(resolve => { if (p.exitCode !== null) return resolve(true); const timer=setTimeout(()=>resolve(false),timeout); p.once('close',()=>{clearTimeout(timer);resolve(true);}); }); }
  private signalGroup(p: ChildProcess, signal: NodeJS.Signals) { if (!p.pid || p.exitCode !== null) return; try { process.kill(-p.pid, signal); } catch { try { p.kill(signal); } catch {} } }
  async stop(name: string, gracefulInput?: string, timeout=20000) {
    const p=this.get(name); if (!p) return;
    if (gracefulInput && p.stdin?.writable) p.stdin.write(gracefulInput);
    if (await this.waitForClose(p, timeout)) return;
    this.log({time:new Date().toISOString(),source:name as 'teleop',level:'error',message:'Saída normal demorou; enviando SIGINT para executar a limpeza do Python'});
    this.signalGroup(p, 'SIGINT');
    if (await this.waitForClose(p, 12000)) return;
    this.log({time:new Date().toISOString(),source:name as 'teleop',level:'error',message:'Rotina de limpeza excedeu o limite; encerrando o grupo de processos'});
    this.signalGroup(p, 'SIGTERM');
    await this.waitForClose(p, 3000);
  }
}
