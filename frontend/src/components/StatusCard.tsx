import type {LucideIcon} from 'lucide-react';
import type {Check} from '../types';
import StatusLed from './StatusLed';

export default function StatusCard({title,check,icon:Icon,primary=false}:{title:string;check?:Check;icon:LucideIcon;primary?:boolean}){
  const label=(check?.label??'').toLowerCase();
  const waiting=!check||label.includes('aguard')||label.includes('parad')||label.includes('inativ');
  const state=!check?'checking':check.ok?'online':waiting?'waiting':'offline';
  const readable=!check?'VERIFICANDO':check.ok?check.label:waiting?check.label:'INDISPONÍVEL';
  const ledState=!check?'checking':check.ok?'ready':waiting?'warning':'error';
  return <div className={`status-item ${state} ${primary?'robot-primary':''}`}>
    <div className="status-item-icon"><Icon/></div>
    <div className="status-item-copy"><b>{title}</b><span><StatusLed state={ledState} pulse={ledState!=='ready'}/>{readable}</span></div>
    {primary&&<small>{check?.detail??'Verificando conexão'}</small>}
  </div>;
}
