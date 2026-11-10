# Strike Neon — Android WebView + AdMob nativo

## Estado desta versão

A aplicação Android usa uma `WebView` Android real que carrega `https://strike-neon-arcade.vercel.app/`. O jogo continua a ser a aplicação React/TypeScript original; não foi reconstruído. A TWA/PWABuilder foi substituída nesta variante, conforme autorização expressa, porque a TWA padrão não permite alojar um `AdView` nativo na hierarquia de Views da Activity.

A Activity tem um `WebView` com peso flexível e um contentor Android separado para o banner. Assim, o banner não tapa o canvas nem os controlos e não provoca uma redução duplicada da área de jogo. A barra de endereço do Chrome não aparece porque o conteúdo é apresentado numa WebView.

## AdMob implementado

| Tipo | ID de produção |
|---|---|
| Application ID | `ca-app-pub-9379861410362276~8805957593` |
| Banner | `ca-app-pub-9379861410362276/3117504887` |
| Interstitial | `ca-app-pub-9379861410362276/9176354610` |

- SDK: `com.google.android.gms:play-services-ads:25.5.0`.
- Banner adaptativo ancorado na parte inferior, fora da WebView.
- Interstitial pré-carregado e solicitado no `game_over`; um objeto de anúncio só é mostrado uma vez.
- Falha de carregamento/mostrar notifica o JavaScript para retomar o jogo; há também um failsafe JavaScript.
- Builds `debug` usam App ID e unidades de teste oficiais Google. Builds `release` usam os IDs de produção acima.
- UMP SDK `4.0.0` pede atualização de consentimento em cada arranque e só permite pedidos depois de `canRequestAds()`. O menu Settings inclui o ponto de entrada de opções de privacidade quando a ponte nativa está presente.
- A versão web/Vercel não carrega AdSense nem H5 Games Ads e não simula anúncios.

## Ponte JavaScript / Android

`window.StrikeNeonNative` é exposta pela `addJavascriptInterface` e implementa anúncios, privacidade, ligação à Play Billing, compras de shards, restauro e abertura da Play Store. A ponte só deve ser usada com o domínio oficial. A WebView aceita navegação interna apenas em `strike-neon-arcade.vercel.app`; outros links são enviados para aplicações externas.

## Compras in-app

A migração de TWA para WebView retira a Digital Goods API do caminho de compra. Para preservar a loja, o Android inclui Google Play Billing Library `9.1.0` e uma ponte nativa para os produtos `shards_500`, `shards_1000`, `shards_2500` e `shards_weekly_090`. O fluxo credita shards apenas depois de `PURCHASED` e `consumeAsync` bem-sucedido. A página confirma a receção da entrega nativa para evitar repetição.

**Limitação de segurança:** o projeto fornecido não contém backend de validação de compras. Para produção com proteção antifraude forte, validar `purchaseToken` no servidor através da Google Play Developer API antes de creditar bens. O crédito local é compatível com a arquitetura existente, mas não substitui validação server-side.

## Abrir e compilar

Requisitos: Android Studio recente, JDK 17, Android SDK Platform 36 e ligação à Internet para resolver dependências Gradle.

```bash
cd android
./gradlew assembleDebug
```

O APK de debug fica em `android/app/build/outputs/apk/debug/`. Este build usa anúncios de teste. Para AAB de produção:

```bash
cd android
./gradlew bundleRelease
```

A assinatura release ainda tem de ser configurada com a keystore privada do proprietário. Nunca colocar a keystore nem passwords no ZIP. Depois da assinatura, enviar primeiro para Internal testing e validar num dispositivo real.

## Configuração AdMob externa obrigatória

1. Confirmar que o App ID e os dois ad units estão ativos e associados à app Android `com.sarfen1.strikeneon` na conta AdMob.
2. Em AdMob → Privacy & messaging, criar e publicar mensagens GDPR/EEA para esta app. Sem uma mensagem CMP publicada ou consentimento elegível, UMP pode impedir pedidos de anúncios.
3. Confirmar a associação da app na Play Console e publicar o `app-ads.txt` em `https://strike-neon-arcade.vercel.app/app-ads.txt`.
4. Testar sempre builds debug com anúncios de teste; nunca clicar nos anúncios de produção durante testes.
5. Após publicar a release, aguardar a revisão/ativação de inventário da AdMob. Um SDK compilado não garante preenchimento: rede, consentimento, inventário e estado da conta determinam se há anúncio.

## Digital Asset Links / SHA-256

O `assetlinks.json` mantém o package e o fingerprint App signing key fornecidos. WebView não depende de Digital Asset Links para remover a barra do Chrome; o ficheiro continua publicado para a associação Android declarada. O certificado release efetivamente instalado deve corresponder ao fingerprint da Play App Signing key.

## Testes que ainda têm de ser feitos fora deste ambiente

- Sincronizar Gradle no Android Studio e executar `assembleDebug` / `bundleRelease`.
- Instalar debug num dispositivo Android com Google Play Services e verificar banner de teste e interstitial de teste.
- Testar consentimento UMP num dispositivo de teste EEA e testar a opção de privacidade.
- Testar a versão release assinada através de Internal testing para confirmar os ad units de produção e compras reais/teste.
- Verificar no AdMob a receção de pedidos/impressões e o estado dos ad units.

Este ambiente de trabalho não tem Android SDK/Gradle instalado e a instalação npm excedeu o tempo limite; por isso não se declara build Android ou Vite concluído aqui.
