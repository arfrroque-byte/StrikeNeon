# Strike Neon — guia rápido (PT)

## O que foi alterado
- Mantido o código React/TypeScript e o motor de jogo original.
- Criado projeto Android nativo com WebView, package `com.sarfen1.strikeneon` e ecrã sem barra de endereço Chrome.
- Implementado Google Mobile Ads SDK com banner inferior e interstitial no fim da partida.
- Implementado UMP para consentimento de anúncios, incluindo EEE/Portugal.
- Implementada ponte Kotlin para AdMob e Google Play Billing.
- Mantidos os IDs AdMob oficiais em builds release; builds debug usam IDs de teste oficiais.
- Removida a tentativa de usar AdSense/H5 Games Ads como se fossem AdMob.

## Publicar o site na Vercel por upload
1. Extrair `Strike_Neon_Vercel_Final.zip`.
2. Na raiz do projeto executar `npm install` e `npm run build`.
3. Confirmar que `dist/.well-known/assetlinks.json` existe. O comando `npm run build` executa `scripts/verify-production.mjs` e falha se o ficheiro ou fingerprint estiverem errados.
4. No painel Vercel, carregar o conteúdo completo da pasta `dist` (não carregar a pasta `dist` como subpasta).
5. Garantir que o gestor de ficheiros não omite `.well-known`.
6. Testar `https://strike-neon-arcade.vercel.app/.well-known/assetlinks.json` e `https://strike-neon-arcade.vercel.app/app-ads.txt`.

## Gerar Android
1. Instalar Android Studio, JDK 17 e Android SDK 36.
2. Abrir a pasta `android/` no Android Studio e sincronizar Gradle.
3. Executar `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).
4. Instalar o APK debug: usa anúncios de teste Google.
5. Para AAB: `./gradlew bundleRelease`. Configurar assinatura release privada antes de enviar para Play Console.

## Verificar AdMob
- O banner deve aparecer abaixo da área React, sem tapar botões.
- O interstitial é pré-carregado e pedido no Game Over.
- Se não houver anúncio, o jogo retoma sem bloquear.
- Verificar logs `StrikeNeonAds` no Logcat.
- Para release, confirmar no AdMob pedidos, impressões, consentimento e estado dos ad units.
- Nunca clicar nos anúncios de produção durante testes.

## Configuração externa obrigatória
- Criar/publicar mensagem GDPR/EEA em AdMob → Privacy & messaging.
- Confirmar App ID e unidades de anúncio associados à app Android.
- Publicar/confirmar `app-ads.txt` em `https://strike-neon-arcade.vercel.app/app-ads.txt`.
- Configurar keystore de release no Android Studio/Gradle fora do ZIP.
- Criar Internal testing na Play Console e adicionar testadores/licenças conforme necessário.
- Para segurança antifraude de compras, implementar verificação server-side do purchaseToken.

## Estado honesto dos testes
O projeto foi analisado e as alterações foram aplicadas aos ficheiros. Não foi possível executar o build Vite: `npm install` excedeu o tempo limite neste ambiente. Também não existe Android SDK nem Gradle instalado neste ambiente, pelo que não foi possível compilar APK/AAB nem testar anúncios num dispositivo. Os anúncios só podem ser considerados verificados depois do teste com APK num Android com Google Play Services e da confirmação no painel AdMob.
