# DoseCerta Mobile (Expo)

App React Native que usa a mesma API FastAPI do backend.

## Rodar

1. Suba a API:
```bash
npm run dev:api
```

2. No celular (Expo Go) ou emulador:
```bash
cd mobile
npm start
```

Escaneie o QR code com o **Expo Go**.

### API no dispositivo físico

No `.env` da pasta `mobile/` (ou export):

```bash
# IP da sua máquina na mesma Wi-Fi
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8000/api
```

Sem essa variável:
- iOS Simulator → `http://127.0.0.1:8000/api`
- Android Emulator → `http://10.0.2.2:8000/api`
- Expo Go (rede) → tenta o host do Metro automaticamente

## Fluxo

1. Descreva o tratamento
2. Toque em **Montar** (ou **WhatsApp** para o fluxo conversacional)
3. Confirme o rascunho
4. Puxe para atualizar / veja o log de mensagens
