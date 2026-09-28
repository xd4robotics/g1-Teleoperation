# Perfis wireless do G1

O túnel original continua em `tools/g1_l2_udp_tunnel.py`. Não houve mudança no
encapsulamento UDP, fragmentação (1200 bytes), TAP, MAC-NAT ou DDS. O arquivo
`~/.config/g1-wireless-dds-profile` no notebook e
`/home/unitree/.config/g1-wireless-dds-profile` na Jetson seleciona os IPs
usados pelos serviços `g1-dds-wifi-local.service` e `g1-dds-wifi.service`.

| Perfil | Notebook | Jetson | Rede interna |
|---|---|---|---|
| `xd4` | 192.168.8.24 | 192.168.8.18 | TAP .123.99, Jetson eth0 .123.164, PC1 .123.161 |
| `robot` | 192.168.3.10 | 192.168.3.20 | Os mesmos endereços internos |

## Teste offline da Rede robô G1

1. Mantenha o cabo notebook–Jetson disponível até confirmar que a Jetson está
   na `Rede robô G1` com `wlan0 = 192.168.3.20`. Depois desconecte o cabo.
2. Conecte **manualmente** notebook e Quest à `Rede robô G1`. Não é necessário
   Internet para validar DDS e TeleImager, mas `vuer.ai` pode não carregar pela
   primeira vez sem Internet no Quest.
3. No notebook, execute:

   ```bash
   cd /home/xd4robotics/g1_teleoperation
   ./scripts/wireless_dds_start.sh robot
   ./scripts/wireless_profile_test.sh robot
   ```

   O primeiro comando pode pedir a senha `sudo` da Jetson. O segundo não envia
   comandos de movimento; testa IPs, túnel, PC1, lowstate, TeleImager e backend.
   A verificação de backend só passa se ele estiver rodando.

4. Para operar via frontend, pare a instância anterior de `npm run dev` que
   usava `xd4` e inicie a aplicação com:

   ```bash
   ./scripts/run_profile.sh robot
   ```

   Frontend: `http://192.168.3.10:5173`. O link do Vuer usa automaticamente
   o hostname pelo qual o frontend foi aberto, resultando em
   `wss://192.168.3.10:8012`.

## Voltar imediatamente à xd4 main

Se o teste falhar, reconecte **manualmente** o notebook à `xd4 main`. Se a
Jetson ainda estiver em `.3.20`, use o cabo de segurança para acessar
`unitree@192.168.123.164` e ativar o perfil Wi-Fi salvo `xd4 main` nela:

```bash
ssh -tt unitree@192.168.123.164 'sudo nmcli connection up uuid d0d5d2ed-d920-4da5-85a3-fa1e56b2e957'
```

Depois, sem o cabo:

```bash
cd /home/xd4robotics/g1_teleoperation
./scripts/wireless_dds_start.sh xd4
./scripts/wireless_profile_test.sh xd4
./scripts/run_profile.sh xd4
```

O perfil `xd4` preserva os IPs antigos e permanece o padrão dos scripts.
O `run_profile.sh` requer que qualquer instância anterior do frontend/backend
tenha sido encerrada antes, para liberar as portas 3001 e 5173.
