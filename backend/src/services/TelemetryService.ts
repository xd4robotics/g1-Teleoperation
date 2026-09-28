import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {config} from '../config.js';
import type {Telemetry} from '../types.js';

const scriptPath=new URL('../../../tools/lowstate_telemetry.py',import.meta.url).pathname;
const unavailable=():Telemetry=>({lowstate:false,modeMachine:null,motorTemperatureMaxC:null,batteryPercent:null,sampledAt:null});
let cache:Telemetry=unavailable();
let lastRead=0;
let pending:Promise<Telemetry>|undefined;

function run(command:string,args:string[],input?:Buffer):Promise<Telemetry>{
  return new Promise<Telemetry>(resolve=>{
    const child=spawn(command,args,{stdio:['pipe','pipe','ignore']});
    let stdout='';
    const timer=setTimeout(()=>child.kill('SIGTERM'),5000);
    child.stdout.on('data',(part:Buffer)=>stdout+=part.toString());
    child.stdin.on('error',()=>{});
    child.stdin.end(input);
    child.once('error',()=>{clearTimeout(timer);resolve(unavailable())});
    child.once('close',()=>{
      clearTimeout(timer);
      try{const value=JSON.parse(stdout) as Omit<Telemetry,'sampledAt'>;resolve({...value,sampledAt:value.lowstate?new Date().toISOString():null});}
      catch{resolve(unavailable())}
    });
  });
}

export function readTelemetry():Promise<Telemetry>{
  if(Date.now()-lastRead<2500)return Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{
    const local=await run(config.pythonPath,[scriptPath,config.networkInterface,'--timeout','2']);
    if(local.lowstate&&local.batteryPercent!==null)return local;
    const source=readFileSync(scriptPath);
    for(const host of [...new Set([config.g1Host,'192.168.123.164'])]){
      const remote=await run('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=2','-i',config.sshKey,`${config.g1User}@${host}`,'python3','-','eth0','--timeout','1.5'],source);
      if(remote.lowstate)return remote;
    }
    return local;
  })().then(value=>{cache=value;lastRead=Date.now();pending=undefined;return value}).catch(()=>{pending=undefined;cache=unavailable();lastRead=Date.now();return cache});
  return pending;
}
