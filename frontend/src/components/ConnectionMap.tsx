import {Bot, Camera, Glasses, Laptop, Network} from 'lucide-react';
import type {Status} from '../types';

export default function ConnectionMap({status}:{status?:Status}){const cameraName=status?.camera.label==='ATIVA COM DJI'?'DJI Osmo':status?.camera.label==='ATIVA COM CÂMERA NATIVA'?'Câmera nativa':'Sem câmera';return <section className="system-visual surface-block">
  <div className="block-heading"><div><Network/><span>Conexão do sistema</span></div><small>Visualização simplificada</small></div>
  <div className="compact-topology">
    <div className={`compact-node ${status?.quest.ok?'connected':''}`}><Glasses/><b>Meta Quest</b><small>{status?.quest.ok?'Conectado':'Aguardando'}</small></div>
    <div className={`compact-link ${status?.quest.ok?'connected':''}`}><i/></div>
    <div className="compact-node connected"><Laptop/><b>Notebook</b><small>Estação</small></div>
    <div className={`compact-link ${status?.g1.ok?'connected':''}`}><i/></div>
    <div className={`compact-node robot ${status?.g1.ok?'connected':''}`}><Bot/><b>Unitree G1</b><small>{status?.g1.ok?'Disponível':'Indisponível'}</small></div>
    <div className={`camera-drop ${status?.camera.ok?'connected':''}`}><span/><div><Camera/><b>{cameraName}</b></div></div>
  </div>
</section>}
