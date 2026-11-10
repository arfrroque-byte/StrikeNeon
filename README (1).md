# Strike Neon

Jogo arcade vertical original desenvolvido com React, TypeScript e Vite. Este pacote preserva o motor de combate, interface neon, hangar, missões, moedas, loja, pontuação, níveis, naves, áudio, controlos mobile e progressão presentes no projeto recebido.

## Identidade
- Nome: **Strike Neon**
- Android package: `com.sarfen1.strikeneon`
- Web: `https://strike-neon-arcade.vercel.app/`
- Stack: React + TypeScript + Vite

## Executar e compilar Web

```bash
npm install
npm run dev
npm run build
```

`npm run build` compila com Vite e executa `scripts/verify-production.mjs`. O verificador confirma que `dist/.well-known/assetlinks.json`, `dist/manifest.webmanifest`, `dist/app-ads.txt` e `dist/index.html` existem; valida package/fingerprint e manifest standalone e procura o package Android antigo.

## Publicar na Vercel por upload

1. Executar `npm install` e `npm run build`.
2. Carregar **o conteúdo da pasta `dist/`** no painel de Deployments da Vercel.
3. Confirmar que o upload inclui a pasta oculta `.well-known/`.
4. Testar `https://strike-neon-arcade.vercel.app/.well-known/assetlinks.json` e `https://strike-neon-arcade.vercel.app/app-ads.txt`.

Não é necessário GitHub nem Vercel CLI. O `vercel.json` original foi preservado.

## Android e anúncios

A variante Android foi migrada de TWA para **WebView nativa**, conforme autorização do proprietário, para permitir um `AdView` Android real separado da WebView. O projeto Android encontra-se em `android/`. O SDK Google Mobile Ads e UMP são integrados nativamente; o banner é adaptativo e fixo abaixo do jogo e o interstitial é pedido no Game Over. A WebView carrega a versão publicada no domínio Vercel.

Ver `ANDROID.md` e `README-ANDROID-PT.md` para compilar, configurar consentimento UMP, testar anúncios, Play Billing e assinar release.

### IDs AdMob (produção)
- App: `ca-app-pub-9379861410362276~8805957593`
- Banner: `ca-app-pub-9379861410362276/3117504887`
- Interstitial: `ca-app-pub-9379861410362276/9176354610`

Builds Android `debug` usam App ID e ad units de teste oficiais Google. Builds `release` usam os IDs de produção.

## Limitações de validação desta entrega

O ambiente de preparação não conseguiu resolver o host do Gradle e `npm install` excedeu o tempo limite. Por isso não foi possível executar `vite build`, TypeScript tests, `assembleDebug` ou `bundleRelease`, nem testar anúncios em dispositivo. Os ficheiros de integração estão incluídos, mas a funcionalidade só fica comprovada após compilar no Android Studio, instalar num Android com Google Play Services e verificar pedidos/impressões no painel AdMob. Configuração GDPR/EEA, ad units ativos, `app-ads.txt` publicado e assinatura release continuam dependências da conta do proprietário.
