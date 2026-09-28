export type LedState='idle'|'checking'|'ready'|'active'|'warning'|'error';

export default function StatusLed({state='idle',pulse=false}:{state?:LedState;pulse?:boolean}){
  return <i className={`status-led ${state} ${pulse?'pulse':''}`} aria-hidden="true"/>;
}
