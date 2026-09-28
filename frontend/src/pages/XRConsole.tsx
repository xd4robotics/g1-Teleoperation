import {useEffect,useRef,useState} from 'react';
import {Battery, Bot, Camera, Gamepad2, Glasses, Radio, ScanLine, Video, Wifi, X} from 'lucide-react';
import type {Status} from '../types';
import './xr-console.css';

// The installed Vuer server serves its web client on the same TLS port.
// Keep the headset entry point local so the robot-only Wi-Fi works offline.
const VUER_URL=`https://${window.location.hostname}:8012/?ws=wss://${window.location.hostname}:8012&grid=False`;

function LiveCamera({enabled}:{enabled:boolean}){
  const video=useRef<HTMLVideoElement>(null);
  const [state,setState]=useState<'idle'|'connecting'|'live'|'error'>('idle');
  useEffect(()=>{
    if(!enabled){setState('idle');return}
    let disposed=false;
    const pc=new RTCPeerConnection({sdpSemantics:'unified-plan'} as RTCConfiguration);
    const connect=async()=>{
      try{
        setState('connecting');
        pc.addTransceiver('video',{direction:'recvonly'});
        pc.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0];video.current.play().catch(()=>{})}setState('live')};
        await pc.setLocalDescription(await pc.createOffer());
        if(pc.iceGatheringState!=='complete')await new Promise<void>(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve()}};pc.addEventListener('icegatheringstatechange',done)});
        const response=await fetch('/api/camera/webrtc/offer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:pc.localDescription?.sdp,type:pc.localDescription?.type,codec:'h264'})});
        if(!response.ok)throw new Error(`WebRTC ${response.status}`);
        await pc.setRemoteDescription(await response.json());
      }catch{if(!disposed)setState('error')}
    };
    connect();
    return()=>{disposed=true;pc.close();if(video.current)video.current.srcObject=null};
  },[enabled]);
  return <div className={`xr-camera-feed ${state}`}><video ref={video} autoPlay playsInline muted/>{state!=='live'&&<div className="xr-camera-empty"><ScanLine/><b>{state==='connecting'?'Conectando à DJI':state==='error'?'Preview indisponível':enabled?'Aguardando vídeo':'Câmera desligada'}</b><span>{state==='error'?'A operação XR continua disponível.':'O stream aparece aqui quando o TeleImager estiver pronto.'}</span></div>}<i className="scan"/></div>
}

export default function XRConsole({status}:{status?:Status}){
  const [selected,setSelected]=useState<'vr'|'passthrough'>('vr');
  const online=!!status?.g1.ok;
  const ready=!!status?.camera.ok&&!!status?.vuer.ok;
  const active=status?.phase==='active';
  const openVuer=()=>window.location.assign(VUER_URL);
  return <main className="xr-console">
    <div className="xr-grid"/><div className="xr-orbit orbit-a"/><div className="xr-orbit orbit-b"/>
    <header className="xr-topbar">
      <div className={`xr-system ${ready?'ok':''}`}><i/><div><span>SISTEMA</span><b>{ready?'CONECTADO':'AGUARDANDO'}</b></div></div>
      <div className="xr-network"><div><Wifi/><span>REDE<b>{status?.ethernet.ok?'CONECTADA':'INDISPONÍVEL'}</b></span></div><div><Bot/><span>ROBÔ<b>{online?'ONLINE':'OFFLINE'}</b></span></div><div><Gamepad2/><span>CONTROLE<b>{active?'ATIVO':'INATIVO'}</b></span></div><time>{new Date(status?.timestamp??Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>
    </header>

    <section className="xr-brand"><div><img src="/xd4roboticspreto.svg" alt="XD4 Robotics"/></div><p>TELEOPERAÇÃO IMERSIVA · UNITREE G1</p></section>

    <aside className="xr-robot-panel xr-glass"><span className="corner"/><small>ROBÔ SELECIONADO</small><h1>UNITREE G1 EDU</h1><div className={`xr-readiness ${online?'ok':''}`}><i/>STATUS <b>{online?'PRONTO':'INDISPONÍVEL'}</b></div><div className="xr-bot-visual"><Bot/></div><dl><div><dt><Battery/> BATERIA</dt><dd>SEM DADOS</dd></div><div><dt><Radio/> DDS</dt><dd>{online?'RECEBENDO':'SEM DADOS'}</dd></div><div><dt><Glasses/> QUEST</dt><dd>{status?.quest.ok?'CONECTADO':'AGUARDANDO'}</dd></div></dl></aside>

    <section className="xr-mode-zone">
      <button className={selected==='vr'?'selected':''} onClick={()=>setSelected('vr')}><div><Glasses/></div><b>REALIDADE VIRTUAL</b><span>Visão imersiva da câmera do G1</span><i>›</i></button>
      <button className={selected==='passthrough'?'selected':''} onClick={()=>setSelected('passthrough')}><div><Camera/></div><b>PASS-THROUGH</b><span>Ambiente real do operador</span><i>›</i></button>
      <button className="xr-enter" disabled={!ready} onClick={openVuer}>{ready?'ENTRAR NA EXPERIÊNCIA XR':'PREPARE O SISTEMA NO PAINEL DE OPERAÇÃO'}</button>
    </section>

    <aside className="xr-camera-panel xr-glass"><span className="corner"/><div className="xr-panel-title"><b>CÂMERA HEAD</b><em>DJI OSMO ACTION 5 PRO</em></div><LiveCamera enabled={!!status?.camera.ok}/><div className="xr-camera-meta"><span>RESOLUÇÃO<b>1280 × 720</b></span><span>FPS<b>30</b></span><span>CODEC<b>H264</b></span></div><div className={`xr-connection ${status?.camera.ok?'ok':''}`}>CONEXÃO <b>{status?.camera.ok?'ESTÁVEL':'INDISPONÍVEL'}</b></div></aside>
    <a className="xr-close" href="/" aria-label="Voltar à operação"><X/></a>
  </main>
}
