import {useEffect,useRef,useState} from 'react';
import {ArrowDown,Battery,Bot,Camera,Check,Expand,Gamepad2,Hand,Headset,LoaderCircle,Play,Power,Radio,Square,Thermometer,TriangleAlert,Wifi,X} from 'lucide-react';
import type {Log,Mode,Status,Telemetry} from '../types';
import {post} from '../api';

const modes:{id:Mode;name:string;icon:typeof Hand}[]=[
  {id:'hands',name:'Hand Tracking',icon:Hand},
  {id:'controllers',name:'Controles',icon:Gamepad2},
  {id:'motion',name:'Controle completo',icon:Gamepad2},
];

function CameraView({enabled,detail}:{enabled:boolean;detail?:string}){
  const videoRef=useRef<HTMLVideoElement>(null);
  const frameRef=useRef<HTMLDivElement>(null);
  const [state,setState]=useState<'idle'|'connecting'|'live'|'error'>('idle');
  const [streamError,setStreamError]=useState('');
  const [fps,setFps]=useState<number|null>(null);
  const [retryToken,setRetryToken]=useState(0);
  const retryCount=useRef(0);
  useEffect(()=>{
    if(!enabled){setState('idle');setStreamError('');setFps(null);retryCount.current=0;return}
    let disposed=false;
    let frameHandle=0;
    let retryHandle=0;
    let frameCount=0;
    let frameStart=performance.now();
    const pc=new RTCPeerConnection();
    pc.addTransceiver('video',{direction:'recvonly'});
    const countFrame=(_now:number,_meta:VideoFrameCallbackMetadata)=>{
      if(disposed)return;
      frameCount++;
      const now=performance.now();
      if(now-frameStart>=1000){setFps(Math.round(frameCount*1000/(now-frameStart)));frameCount=0;frameStart=now}
      if(videoRef.current)frameHandle=videoRef.current.requestVideoFrameCallback(countFrame);
    };
    pc.ontrack=event=>{
      const video=videoRef.current;
      if(!video)return;
      video.srcObject=event.streams[0];
      video.onplaying=()=>{if(!disposed){retryCount.current=0;setState('live');frameHandle=video.requestVideoFrameCallback(countFrame)}};
      video.play().catch(error=>{if(!disposed){setStreamError(`Reprodução: ${error instanceof Error?error.message:String(error)}`);setState('error')}});
    };
    const retry=()=>{if(!disposed&&retryCount.current<3){retryCount.current++;retryHandle=window.setTimeout(()=>setRetryToken(value=>value+1),1500)}};
    pc.onconnectionstatechange=()=>{if(!disposed&&['failed','disconnected','closed'].includes(pc.connectionState)){setStreamError(`Conexão WebRTC: ${pc.connectionState}`);setState('error');setFps(null);retry()}};
    const connect=async()=>{
      try{
        setState('connecting');
        await pc.setLocalDescription(await pc.createOffer());
        if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
          const timer=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);reject(new Error('ICE timeout'))},5000);
          const done=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',done);resolve()}};
          pc.addEventListener('icegatheringstatechange',done);
        });
        const response=await fetch('/api/camera/webrtc/offer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:pc.localDescription?.sdp,type:pc.localDescription?.type,codec:'h264'})});
        if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.error==='string'?body.error:`WebRTC HTTP ${response.status}`)}
        await pc.setRemoteDescription(await response.json());
      }catch(error){if(!disposed){setStreamError(error instanceof Error?error.message:String(error));setState('error');retry()}}
    };
    connect();
    return()=>{disposed=true;if(retryHandle)window.clearTimeout(retryHandle);if(frameHandle&&videoRef.current)videoRef.current.cancelVideoFrameCallback(frameHandle);pc.close();if(videoRef.current){videoRef.current.onplaying=null;videoRef.current.srcObject=null}};
  },[enabled,retryToken]);
  return <section className="station-camera" ref={frameRef} aria-label="Visão do robô">
    <div className="camera-topline"><span className={state==='live'?'live':'muted'}><i/>{state==='live'?'LIVE':state==='connecting'?'CONECTANDO':'SEM VÍDEO'}</span></div>
    <video ref={videoRef} autoPlay playsInline muted/>
    {state!=='live'&&<div className="camera-placeholder"><Camera/><strong>{state==='error'?'STREAM INDISPONÍVEL':enabled?'CONECTANDO À CÂMERA':'CÂMERA INDISPONÍVEL'}</strong><span>{state==='error'?streamError||'Falha na conexão WebRTC.':enabled?'Aguardando vídeo do TeleImager.':detail??'Inicie o sistema para disponibilizar o vídeo.'}</span></div>}
    <div className="camera-bottomline"><span>{detail?.includes('NATIVA')?'CÂMERA NATIVA':'CÂMERA HEAD'}</span><span>{fps!==null?`${fps} FPS`:'FPS --'}</span><span>LATÊNCIA --</span><button type="button" onClick={()=>frameRef.current?.requestFullscreen()} aria-label="Expandir câmera"><Expand/></button></div>
  </section>;
}

function BatteryGauge({value}:{value:number|null|undefined}){
  const level=value??0;
  const tone=value===null||value===undefined?'unknown':value<=20?'critical':value<=40?'warning':'good';
  return <div className={`battery-gauge ${tone}`} role="img" aria-label={value==null?'Bateria sem dados':`Bateria ${value}%`}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="gauge-track" cx="50" cy="50" r="42"/><circle className="gauge-progress" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${level} 100`}/></svg><div><Battery size={19}/><strong>{value==null?'--':value}<small>{value==null?'':'%'}</small></strong></div></div>;
}

export default function Dashboard({status,telemetry,logs}:{status?:Status;telemetry?:Telemetry;logs:Log[]}){
  const [mode,setMode]=useState<Mode>('hands');
  const [showMotionInfo,setShowMotionInfo]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [eventsOpen,setEventsOpen]=useState(false);
  useEffect(()=>{if(status&&!['idle','error'].includes(status.phase))setMode(status.mode)},[status?.mode,status?.phase]);
  const action=async(path:string,body?:unknown)=>{setBusy(true);setError('');try{await post(path,body)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const phase=status?.phase??'idle';
  const idle=phase==='idle'||phase==='error';
  const prepared=phase==='ready'||phase==='active'||phase==='stopping';
  const canActivate=phase==='ready'&&!busy&&!!status?.quest.ok;
  const canStop=phase!=='idle'&&phase!=='error'&&!busy;
  const selectMode=(next:Mode)=>{if(next==='motion'&&mode!=='motion')setShowMotionInfo(true);setMode(next)};
  const latestError=[...logs].reverse().find(item=>item.level==='error');
  const displayed=eventsOpen?logs.slice(-80).reverse():logs.slice(-3).reverse();
  return <main className="station-workspace">
    <div className="station-grid">
      <aside className="station-operations">
        <div className="rail-heading"><span>Controle</span></div>
        <div className="station-mode"><label htmlFor="operation-mode">Modo de operação</label><div id="operation-mode" role="group" aria-label="Modo de controle">{modes.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={mode===item.id?'selected':''} aria-pressed={mode===item.id} disabled={!idle||busy} onClick={()=>selectMode(item.id)}><Icon/><span>{item.name}</span>{mode===item.id&&<Check className="mode-check"/>}</button>})}</div></div>
        <div className="operation-flow" aria-label="Sequência de operação">
          <section className={prepared?'is-done':phase==='preparing'?'is-running':'is-next'}><div className="flow-stage"><span>1</span><div><strong>Preparar</strong><small>{prepared?'Sistema pronto':phase==='preparing'?'Preparando sistema':'Início da sessão'}</small></div>{prepared?<Check className="flow-state"/>:null}</div><button className="prepare" disabled={busy||phase==='preparing'||prepared} onClick={()=>action('/teleop/prepare',{mode})}>{phase==='preparing'?<LoaderCircle className="spinning"/>:prepared?<Check/>:<Power/>}{prepared?'Preparado':phase==='preparing'?'Preparando':'Preparar sistema'}</button></section>
          <section className={phase==='active'?'is-running':canActivate?'is-next':''}><div className="flow-stage"><span>2</span><div><strong>Movimento</strong><small>{phase==='active'?'Controle habilitado':canActivate?'Pronto para iniciar':'Aguardando preparação'}</small></div>{phase==='active'?<Check className="flow-state"/>:null}</div><button className="activate" disabled={!canActivate} onClick={()=>action('/teleop/activate')}><Play/>{phase==='active'?'Movimento ativo':'Habilitar movimento'}</button></section>
          <section className="flow-end"><div className="flow-stage"><span>3</span><div><strong>Encerrar</strong><small>{phase==='stopping'?'Finalizando sessão':canStop?'Disponível durante a sessão':'Sessão não iniciada'}</small></div></div><button className="stop" disabled={!canStop} onClick={()=>action('/teleop/stop')}><Square/>{phase==='stopping'?'Encerrando':'Encerrar sessão'}</button></section>
        </div>
        {error&&<div className="station-alert" role="alert"><TriangleAlert/><span>{error}</span></div>}
        <section className={`station-events ${eventsOpen?'expanded':''}`}><button type="button" className="events-heading" onClick={()=>setEventsOpen(!eventsOpen)} aria-expanded={eventsOpen}><strong>EVENTOS</strong><span>{eventsOpen?'RECOLHER':`${logs.length} REGISTROS`}</span></button>{latestError&&!eventsOpen&&<p className="last-error"><TriangleAlert/>{latestError.message}</p>}<div className="events-list">{displayed.map((item,index)=><div key={`${item.time}-${index}`} className={item.level}><time>{new Date(item.time).toLocaleTimeString()}</time><b>{item.level.toUpperCase()}</b><span>{item.message}</span></div>)}{!displayed.length&&<p>Sem eventos nesta sessão</p>}</div></section>
      </aside>
      <CameraView enabled={!!status?.camera.ok} detail={status?.camera.detail}/>
      <aside className="station-telemetry"><div className="rail-heading"><span>Sinais do G1</span><strong>DADOS AO VIVO</strong></div>
        <div className="telemetry-content">
          <div className="telemetry-battery"><BatteryGauge value={telemetry?.batteryPercent}/><div><span>Bateria</span><strong>{telemetry?.batteryPercent==null?'Sem leitura':telemetry.batteryPercent<=20?'Carga baixa':telemetry.batteryPercent<=40?'Atenção à carga':'Carga disponível'}</strong></div></div>
          <div className="telemetry-temperature"><Thermometer/><div><span>Motor mais quente</span><strong>{telemetry?.motorTemperatureMaxC!=null?`${telemetry.motorTemperatureMaxC} °C`:'Sem leitura'}</strong></div></div>
          <div className="telemetry-group-label">Conexões</div>
          <div className="telemetry-link"><Bot/><div><strong>G1 / Jetson</strong><small>{status?.g1.ok?status.g1.detail:telemetry?.lowstate?'Dados recebidos via RJ45':status?.g1.detail??'Sem endereço'}</small></div><b className={status?.g1.ok||telemetry?.lowstate?'up':'down'}>{status?.g1.ok?'Online':telemetry?.lowstate?'Dados ativos':'Offline'}</b></div>
          <div className="telemetry-link"><Radio/><div><strong>Dados do robô</strong><small>{telemetry?.modeMachine!=null?`Lowstate · modo ${telemetry.modeMachine}`:'Sem amostras DDS'}</small></div><b className={telemetry?.lowstate?'up':'down'}>{telemetry?.lowstate?'Recebendo':'Sem dados'}</b></div>
          <div className="telemetry-link"><Wifi/><div><strong>Rede</strong><small>{status?.ethernet.detail??'Sem endereço'} · tap-g1</small></div><b className={status?.ethernet.ok?'up':'down'}>{status?.g1.detail?.startsWith('192.168.3.')?'Robô G1':'xd4 main'}</b></div>
          <div className="telemetry-group-label">Visão e headset</div>
          <div className="telemetry-link"><Camera/><div><strong>Câmera</strong><small>{status?.camera.detail??'Sem informação'}</small></div><b className={status?.camera.ok?'up':'down'}>{status?.camera.ok?'Disponível':'Sem vídeo'}</b></div>
          <div className="telemetry-link"><Headset/><div><strong>Quest / Vuer</strong><small>Quest {status?.quest.ok?'conectado':'aguardando'} · Vuer {status?.vuer.ok?'ativo':'parado'}</small></div><b className={status?.quest.ok&&status?.vuer.ok?'up':'down'}>{status?.quest.ok&&status?.vuer.ok?'Pronto':'Aguardando'}</b></div>
        </div><div className="telemetry-foot">{telemetry?.sampledAt?`Atualizado às ${new Date(telemetry.sampledAt).toLocaleTimeString()}`:'Aguardando leitura do G1'}</div>
      </aside>
    </div>
    {showMotionInfo&&<div className="station-modal-backdrop"><section className="station-modal" role="dialog" aria-modal="true" aria-labelledby="rc-title"><button type="button" className="modal-close" onClick={()=>setShowMotionInfo(false)} aria-label="Fechar"><X/></button><Gamepad2/><h2 id="rc-title">Preparação para locomoção</h2><p>Antes de iniciar a teleoperação com locomoção, coloque o G1 no modo correto pelo controle remoto (RC).</p><div className="rc-steps"><div><kbd>L2</kbd> + <kbd>B</kbd></div><ArrowDown/><div><kbd>L2</kbd> + <kbd>↑</kbd></div><ArrowDown/><div><kbd>R1</kbd> + <kbd>Y</kbd></div></div><p>Depois da sequência, continue normalmente pela interface.</p><button className="ack" onClick={()=>setShowMotionInfo(false)}>ENTENDI</button></section></div>}
  </main>;
}
