# DDS do G1 sem cabo Ethernet

## Causa raiz

O publisher de `rt/lowstate` roda na controladora PC1 (`192.168.123.161`) e publica somente na rede Ethernet interna. A Jetson (`192.168.8.18`/`192.168.123.164`) não é o publisher de movimento. O PC1 não respondeu DDS pela interface Wi-Fi atribuída anteriormente a `192.168.8.26`.

A solução mantém o domínio Ethernet do DDS através de um TAP no notebook e um relay Ethernet-over-UDP sobre a rede `xd4 main`. O relay no G1 aplica MAC-NAT para atravessar a restrição de MAC do enlace interno. Nenhum firmware, serviço Unitree, SDK ou arquivo do PC1 foi alterado.

## Iniciar

1. Ligue o G1 e conecte notebook, G1 e Quest à `xd4 main`.
2. Deixe o cabo Ethernet fisicamente desconectado.
3. Execute:

   ```bash
   cd /home/xd4robotics/g1_teleoperation
   ./scripts/wireless_dds_start.sh
   ```

4. Valide somente leitura:

   ```bash
   /home/xd4robotics/miniconda3/envs/tv/bin/python \
     tools/wifi_lowstate_probe.py tap-g1 --timeout 10
   ```

   O resultado esperado é `LOWSTATE_RECEIVED`.

5. Na teleoperação use:

   ```bash
   cd /home/xd4robotics/xr_teleoperate/teleop
   /home/xd4robotics/miniconda3/envs/tv/bin/python teleop_hand_and_arm.py \
     --input-mode=controller \
     --display-mode=pass-through \
     --arm=G1_29 \
     --img-server-ip=192.168.8.18 \
     --network-interface=tap-g1
   ```

Só habilite movimento com a área do robô segura.

## Parar e restaurar o fallback

```bash
cd /home/xd4robotics/g1_teleoperation
./scripts/wireless_dds_stop.sh
```

Para voltar ao cabo, conecte fisicamente o adaptador e execute `nmcli connection up G1`. O perfil original continua em `192.168.123.99/24` e a interface da teleop cabeada continua sendo `enx00e04c68001a`.

## Depois de reiniciar

O serviço remoto é transitório e as credenciais não são armazenadas. Após cada reboot execute novamente `wireless_dds_start.sh` e repita o probe de `lowstate` antes de iniciar a teleoperação.

## Remoção completa

Pare o relay e remova somente os componentes criados por esta solução:

```bash
./scripts/wireless_dds_stop.sh
nmcli connection delete G1-WiFi-TAP
ssh unitree@192.168.8.18 'rm -f /home/unitree/g1_l2_udp_tunnel.py'
```

O perfil `G1` cabeado não é removido.
