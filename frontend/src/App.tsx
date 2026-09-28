import {useEffect,useState} from 'react';
import {NavLink,Route,Routes,useLocation} from 'react-router-dom';
import {Activity,Radio,Settings2} from 'lucide-react';
import {io} from 'socket.io-client';
import Dashboard from './pages/Dashboard';
import Diagnostics from './pages/Diagnostics';
import XRConsole from './pages/XRConsole';
import type {Log,Status,Telemetry} from './types';
import {get} from './api';

const led=(ok?:boolean)=>ok?'on':'off';

export default function App(){
  const location=useLocation();
  const [status,setStatus]=useState<Status>();
  const [telemetry,setTelemetry]=useState<Telemetry>();
  const [logs,setLogs]=useState<Log[]>([]);
  useEffect(()=>{
    let live=true;
    const refreshStatus=()=>get<Status>('/status').then(value=>{if(live)setStatus(value)}).catch(()=>{});
    refreshStatus();
    const statusInterval=setInterval(refreshStatus,3000);
    const socket=io();
    socket.on('system:status',setStatus);
    for(const event of ['system:log','teleop:log','camera:log'])socket.on(event,(item:Log)=>setLogs(items=>[...items.slice(-499),item]));
    return()=>{live=false;clearInterval(statusInterval);socket.disconnect()};
  },[]);
  useEffect(()=>{
    let live=true;
    const refresh=()=>get<Telemetry>('/telemetry').then(value=>{if(live)setTelemetry(value)}).catch(()=>{if(live)setTelemetry(undefined)});
    refresh();const interval=setInterval(refresh,3500);
    return()=>{live=false;clearInterval(interval)};
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme='dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#090d11');
  },[]);
  if(location.pathname==='/xr-console')return <XRConsole status={status}/>;
  return <div className="station-shell">
    <header className="station-header">
      <NavLink to="/" className="station-brand"><img src="/xd4robotics-branco.svg" alt="XD4 Robotics"/></NavLink>
      <nav className="station-nav"><NavLink to="/" end><Radio/><span>Operação</span></NavLink><NavLink to="/diagnostics"><Settings2/><span>Diagnóstico</span></NavLink></nav>
    </header>
    <Routes>
      <Route path="/" element={<Dashboard status={status} telemetry={telemetry} logs={logs}/>}/>
      <Route path="/diagnostics" element={<main className="station-diagnostics"><Diagnostics status={status} logs={logs}/></main>}/>
    </Routes>
    <div className="station-connection" role="status"><div className="station-health"><span className={led(status?.g1.ok)}><i/>G1</span><span className={led(telemetry?.lowstate)}><i/>DDS</span><span className={led(status?.camera.ok)}><i/>CÂMERA</span><span className={led(status?.quest.ok)}><i/>QUEST</span><span className={led(status?.vuer.ok)}><i/>VUER</span></div><div className="station-session"><Activity size={14}/>{status?.phase==='active'?'CONTROLE ATIVO':status?.phase==='error'?'FALHA DE PREPARAÇÃO':status?.phase==='ready'?'PREPARADO':status?.phase==='preparing'?'PREPARANDO':'EM ESPERA'}</div></div>
  </div>;
}
