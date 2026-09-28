import express from 'express';import cors from 'cors';import {createServer} from 'node:http';import {request as httpsRequest} from 'node:https';import {Server} from 'socket.io';import {config} from './config.js';import {Orchestrator} from './services/Orchestrator.js';import {readTelemetry} from './services/TelemetryService.js';import type {TeleopMode} from './types.js';
const app=express();app.use(cors({origin:config.frontendOrigin}));app.use(express.json());const http=createServer(app);const io=new Server(http,{cors:{origin:config.frontendOrigin}});const core=new Orchestrator((e,d)=>io.emit(e,d));
const route=(fn:(req:express.Request)=>unknown)=>async(req:express.Request,res:express.Response)=>{try{res.json({ok:true,data:await fn(req)});}catch(e){res.status(400).json({ok:false,error:e instanceof Error?e.message:String(e)});}};
app.get('/api/status',route(()=>core.status()));app.get('/api/diagnostics',route(async()=>({status:await core.status(),logs:core.logs,config:{g1Host:config.g1Host,networkInterface:config.networkInterface,teleopPath:config.teleopPath,vuerPort:config.vuerPort,configPort:config.configPort,webrtcPort:config.webrtcPort}})));
app.get('/api/telemetry',route(()=>readTelemetry()));
app.post('/api/camera/webrtc/offer',(req,res)=>{
  const offer={...req.body};
  if(typeof offer.sdp==='string'){
    offer.sdp=offer.sdp.split('\r\n').filter((line:string)=>!line.includes('.local')&&line!=='a=end-of-candidates').join('\r\n');
  }
  const body=JSON.stringify(offer);
  const upstream=httpsRequest({hostname:config.g1Host,port:config.webrtcPort,path:'/offer',method:'POST',rejectUnauthorized:false,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{
    res.status(response.statusCode??502);
    res.type(response.headers['content-type']??'application/json');
    response.pipe(res);
  });
  upstream.setTimeout(8000,()=>upstream.destroy(new Error('Timeout ao negociar WebRTC')));
  upstream.on('error',error=>{if(!res.headersSent)res.status(502).json({error:error.message});else res.end()});
  upstream.end(body);
});
app.post('/api/teleop/prepare',route(req=>{
  if(core.phase==='preparing'||core.phase==='ready'||core.phase==='active'||core.phase==='stopping')throw new Error('Teleoperação já preparada ou em preparação');
  return core.prepare(req.body.mode as TeleopMode);
}));app.post('/api/teleop/activate',route(()=>core.activate()));app.post('/api/teleop/stop',route(()=>core.stop()));app.post('/api/camera/start',route(()=>core.startCamera()));app.post('/api/camera/stop',route(()=>core.restoreCamera()));
io.on('connection',async socket=>socket.emit('system:status',await core.status()));setInterval(()=>core.status().catch(()=>{}),3000);const shutdown=async()=>{await core.stop().catch(()=>{});process.exit(0)};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);http.listen(config.port,()=>console.log(`G1 Teleop API em http://localhost:${config.port}`));
