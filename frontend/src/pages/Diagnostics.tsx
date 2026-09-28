import {useState} from 'react';
import {Check, Clipboard, KeyRound, Network, Terminal} from 'lucide-react';
import type {Log, Status} from '../types';

export default function Diagnostics({status,logs}:{status?:Status;logs:Log[]}){
  const [copied,setCopied]=useState(false);
  const copy=()=>{navigator.clipboard.writeText(JSON.stringify({status,logs},null,2));setCopied(true);setTimeout(()=>setCopied(false),1500)};
  return <>
    <div className="diagnostics-heading diagnostics-actions"><button className="copy" onClick={copy}>{copied?<Check/>:<Clipboard/>}{copied?'Copiado':'Copiar diagnóstico'}</button></div>
    <div className="diag-grid">
      <section className="panel facts"><div className="diagnostic-card-title"><Network/><div><h2>Rede e serviços</h2><p>Endereços e processos da operação</p></div></div><dl><dt>Jetson</dt><dd>{status?.g1.detail??'Indisponível'}</dd><dt>Rede DDS</dt><dd>{status?.ethernet.detail??'Indisponível'}</dd><dt>Interface DDS</dt><dd>tap-g1</dd><dt>Vuer</dt><dd>8012</dd><dt>TeleImager WebRTC</dt><dd>60000 / 60001</dd><dt>Teleop PID</dt><dd>{status?.teleopPid??'Inativo'}</dd></dl></section>
      <section className="panel facts"><div className="diagnostic-card-title"><KeyRound/><div><h2>Acesso e integridade</h2><p>Conectividade dos componentes críticos</p></div></div><dl><dt>Chave SSH</dt><dd className={status?.ssh.ok?'good':'bad'}>{status?.ssh.label??'Verificando'}</dd><dt>G1 SSH</dt><dd className={status?.g1.ok?'good':'bad'}>{status?.g1.label??'Verificando'}</dd><dt>Câmera</dt><dd className={status?.camera.ok?'good':'bad'}>{status?.camera.label??'Verificando'}</dd><dt>Fase</dt><dd>{status?.phase?.toUpperCase()??'Indefinida'}</dd><dt>Último erro</dt><dd className={status?.lastError?'bad':''}>{status?.lastError??'Nenhum'}</dd></dl></section>
    </div>
    <section className="panel logs"><div className="diagnostic-card-title logs-title"><Terminal/><div><h2>Logs em tempo real</h2><p>Saída dos serviços e eventos da sessão</p></div><span>{logs.length} {logs.length===1?'evento':'eventos'}</span></div><div className="log-columns"><span>Horário</span><span>Origem</span><span>Mensagem</span></div><div className="terminal">{logs.length?logs.map((l,i)=><div className={`log-row ${l.level}`} key={i}><time>{new Date(l.time).toLocaleTimeString()}</time><b>{l.source}</b><span>{l.message}</span></div>):<p className="empty-logs">Aguardando eventos do sistema...</p>}</div></section>
  </>;
}
