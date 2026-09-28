export type TeleopMode = 'hands' | 'controllers' | 'motion';
export type Phase = 'idle' | 'preparing' | 'ready' | 'active' | 'stopping' | 'error';
export interface Check { ok: boolean; label: string; detail: string }
export interface Status { timestamp: string; phase: Phase; mode: TeleopMode; g1: Check; ethernet: Check; quest: Check; camera: Check; vuer: Check; ssh: Check; teleopPid?: number; cameraPid?: number; lastError?: string }
export interface Telemetry { lowstate:boolean; modeMachine:number|null; motorTemperatureMaxC:number|null; batteryPercent:number|null; sampledAt:string|null }
export interface LogEntry { time: string; source: 'system'|'teleop'|'camera'; level: 'info'|'error'; message: string }
