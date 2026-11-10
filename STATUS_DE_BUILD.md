# Estado real da validação — Strike Neon

Data da preparação: 03-11-2026.

## Validações concluídas neste ambiente

- 16 testes automatizados de lógica do jogo/ads passaram quando os módulos TypeScript foram transpilados para JavaScript e executados com `node --test`.
- 19 ficheiros `.ts`/`.tsx` passaram a verificação de sintaxe TypeScript (`transpileModule`): 0 erros de sintaxe.
- `AndroidManifest.xml` e `styles.xml` foram analisados como XML válido.
- `assetlinks.json`, `manifest.webmanifest` e `vercel.json` são JSON válido.
- Package Android e fingerprint SHA-256 foram confirmados exatamente contra os valores fornecidos.
- Os três identificadores AdMob de produção foram verificados no código Android e web.
- O package antigo não aparece nos ficheiros do projeto.
- `scripts/verify-production.mjs` passou num diretório `dist` de ensaio que continha os ficheiros públicos e um `index.html` de teste. Isto valida o verificador, não constitui uma compilação Vite.

## Builds que NÃO puderam ser concluídos

### Vite

- `npm install --ignore-scripts --no-audit --no-fund` terminou por timeout neste ambiente.
- `npm run build` foi executado e falhou porque `vite` não estava instalado (`vite: not found`).
- Por isso, não existe `dist/` real compilada nesta entrega.

### Android

- `./gradlew assembleDebug` foi executado.
- O bootstrapper tentou descarregar Gradle 8.13 de `services.gradle.org`, mas a resolução DNS falhou (`Could not resolve host`).
- Não existe Android SDK/Gradle instalado neste ambiente.
- Não foi gerado APK nem AAB; não foi possível verificar a compilação Kotlin contra as bibliotecas Android.

## Testes que ainda exigem ambiente Android/contas externas

- Instalar o APK num dispositivo Android com Google Play Services.
- Confirmar que o banner de teste aparece abaixo da WebView e que o interstitial de teste aparece no Game Over.
- Testar consentimento UMP para EEE/Portugal e a opção de privacidade.
- Confirmar pedidos/impressões no painel AdMob com a app registada e os ad units ativos.
- Configurar a mensagem GDPR/EEA em AdMob → Privacy & messaging.
- Confirmar `app-ads.txt` publicado no domínio.
- Configurar keystore de release e testar AAB assinado via Internal testing.
- Para compras de shards resistentes a fraude, implementar validação do purchaseToken no backend através da Google Play Developer API.

**Conclusão:** os ficheiros-fonte e a integração nativa foram preparados, mas não é correto declarar esta versão pronta para publicação ou afirmar que os anúncios já foram vistos num dispositivo. O passo decisivo agora é compilar e testar o APK debug no Android Studio; a configuração de produção só deve ser validada depois de uma release assinada e dos relatórios AdMob.
