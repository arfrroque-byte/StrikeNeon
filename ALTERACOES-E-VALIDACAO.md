# Strike Neon — alterações solicitadas

## Alterações incluídas
- Trails pagos: 300 Shards cada (o trail predefinido continua gratuito).
- Backgrounds pagos: 200 Shards cada (o background predefinido continua gratuito).
- Sensibilidade aplicada imediatamente durante a gameplay ao alterar Settings.
- Persistência local do perfil, pontuações, Best Kills, kills totais, nome, títulos, shards, conquistas, missões, cosméticos desbloqueados e cosméticos equipados.
- Menu principal: `BEST SCORE` e `BEST KILLS`.
- Missões claimable ordenadas no topo da lista diária/semanal.
- Preços apresentados na interface em USD (`$`).
- Novo banner Weekly Deal com 1.000 Shards por $0.90, no estilo de oferta destacada.

## Produto a criar na Google Play Console
- Product ID: `shards_weekly_090`
- Nome sugerido: `Weekly Deal - 1,000 Shards`
- Tipo: produto único (INAPP / consumível)
- Preço pretendido: USD $0.90
- Quantidade entregue: 1.000 Shards
- Regra no jogo: nova compra desbloqueada após 7 dias da compra anterior no mesmo dispositivo.

**Importante:** o bloqueio semanal é guardado localmente no dispositivo. Para impor o limite de forma antifraude entre dispositivos/reinstalações, é necessária validação e registo server-side da compra. O preço apresentado na interface é USD; o checkout final da Google Play pode apresentar a moeda/preço regional configurado na Play Console.

## Persistência local
Os dados são guardados no armazenamento local da aplicação no telemóvel. Permanecem após fechar e voltar a abrir a aplicação, mas podem ser apagados se o jogador limpar os dados da aplicação, desinstalar o jogo ou limpar os dados do navegador. Isto não é uma cópia de segurança na nuvem.

## Validação executada
- Transpilação sintática TypeScript/TSX: passou.
- Verificação de IDs e quantidades do novo produto: incluída no frontend e na ponte Android.
- Verificação de integridade do ZIP: executada na criação do pacote.
- Build Vite completo: não executado; `npm install` excedeu o tempo limite e o modo offline não tinha dependências em cache.
- Type-check completo: bloqueado pela ausência de `vite/client` (dependências não instaladas).
- Build Android APK/AAB: não executado neste ambiente; Android SDK/Gradle não estão disponíveis.
