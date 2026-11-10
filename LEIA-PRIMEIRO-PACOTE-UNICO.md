# STRIKE NEON — PACOTE ÚNICO

Este ZIP reúne num único projeto:
- Aplicação web React + TypeScript + Vite (raiz do projeto)
- Ficheiros PWA e Digital Asset Links em `public/`
- Projeto Android nativo em `android/` (WebView + Kotlin + Google Mobile Ads SDK + UMP + Billing)

## IMPORTANTE: Vercel e Android são destinos diferentes

A Vercel aloja a versão web. Não executa o SDK Android nem compila APK/AAB.
O projeto Android está incluído neste mesmo ZIP para manter tudo junto, mas tem de ser compilado no Android Studio.

## Publicação web manual na Vercel

1. Extrair este ZIP.
2. No computador, abrir um terminal na pasta `StrikeNeon_Vercel_Final`.
3. Executar `npm install`.
4. Executar `npm run build`.
5. Confirmar que existe `dist/.well-known/assetlinks.json`.
6. Carregar o CONTEÚDO da pasta `dist` para a publicação manual da Vercel, incluindo a pasta oculta `.well-known`.

Não carregar a pasta `android/` como se fosse conteúdo do site. Ela é código-fonte Android e não faz parte do deploy web.

## Compilação Android

Abrir a subpasta `android/` no Android Studio e compilar primeiro uma variante debug.
Consultar `android/README-ANDROID-PT.md` e `android/STATUS_DE_BUILD.md`.

## Estado de validação

Este pacote contém código-fonte. Não inclui `dist` Vite validada nem APK/AAB.
A instalação de dependências/build não pôde ser concluída no ambiente de preparação por indisponibilidade de rede/Gradle. Não considerar anúncios de produção comprovados até testar a aplicação Android num dispositivo com Google Play Services.
