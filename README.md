# G1 Teleoperation Control

Aplicação local que orquestra o `xr_teleoperate` existente, o TeleImager no G1 e os checks de rede. Ela não altera nem reimplementa os algoritmos Python.

## Pré-requisitos

- Node.js 20+ e npm
- Ambiente Conda `tv`
- Chave SSH sem senha para `unitree@192.168.123.164`
- Regra sudo sem senha no G1, limitada a `/unitree/sbin/mscli startservice|stopservice video_hub_pc4`

## Configuração

O Node.js 20 já está isolado em `.runtime` neste notebook. Use:

```bash
cp .env.example .env
env PATH="$PWD/.runtime/bin:/usr/local/bin:/usr/bin:/bin" npm run dev
```

Abra `http://localhost:5173`. O backend roda em `http://localhost:3001`.

Para criar a chave, use `ssh-keygen -t ed25519` e instale a chave pública no G1. Não armazene senha no projeto. A aplicação espera `/home/xd4robotics/.ssh/id_ed25519`, configurável em `.env`.

## Segurança operacional

O botão **Parar e restaurar** envia `q` ao processo Python e religa obrigatoriamente o `video_hub_pc4`. O backend também tenta executar essa restauração ao receber `SIGINT` ou `SIGTERM`. Antes do modo de locomoção, coloque fisicamente o G1 na sequência confirmada: `L2+B`, `L2+↑`, `R1+Y`.
