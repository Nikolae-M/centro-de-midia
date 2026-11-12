MEDIA HUB — sem servidor, sem chaves, sem Node. Duas pastas: use a do seu navegador.

OPERA  (pasta "opera")
1. Abra opera://extensions e ligue "Modo desenvolvedor".
2. "Carregar sem compactação" -> escolha a pasta "opera".
3. Clique no ícone da extensão (fixe-o no menu de extensões se não aparecer).

FIREFOX  (pasta "firefox")
Teste rápido (some ao fechar o Firefox):
1. Abra about:debugging#/runtime/this-firefox
2. "Carregar extensão temporária..." -> escolha o arquivo firefox/manifest.json.
3. Em about:addons -> Media Hub -> aba "Permissões", ative o acesso aos sites
   (Letterboxd, Backloggd, Skoob). Sem isso a extensão não lê as páginas.
Permanente: envie a pasta "firefox" compactada em .zip para addons.mozilla.org/developers
como "distribuição própria" (gratuito, assinatura automática) e instale o .xpi devolvido.

USAR
- Entre normalmente no Letterboxd, Backloggd e Skoob no navegador onde instalou.
  A extensão encontra seu perfil sozinha; se não achar, o card pede o link (uma vez).

Os dados ficam no próprio navegador; Opera e Firefox não compartilham nada entre si.






**CHANGELOG**
## hub0.5
- Novo site: **Album of the Year (AOTY)** com aba própria. Lê `/user/<nome>/ratings/` (últimos álbuns avaliados, com data e nota de 0 a 100). Manifest ganhou `albumoftheyear.org` (permissão de acesso e script de página).
- Nova aba **Desejados**: reúne as wishlists de cada site — Letterboxd (`/watchlist/`), Backloggd (`/games/wishlist/`) e Skoob (livros não iniciados da estante lida). O AOTY não tem wishlist nesta versão.
- Cada aba de site (Letterboxd, Backloggd, Skoob) ganhou uma divisão de **wishlist** abaixo da atividade.
- Funciona para qualquer usuário: o perfil é detectado no menu do site logado, ou colado como qualquer link do site (perfil, watchlist, ratings...); o link é normalizado para o perfil (`normalizar_perfil`).
- Configurações → Listas: novo limite **Desejos** por site (5–60), além de Início e Aba. O AOTY entra nas listas, na aparência por site e em Dados salvos.
- Camada de dados reorganizada em **fontes** (`fontes` em hub.js): cada fonte tem site + função de leitura e cache próprio (`cache2`), ex. `letterboxd_desejos`.
- Menu View e lateral: Início, Desejados, Letterboxd, Backloggd, Skoob, AOTY, Configurações.
- Pôsteres vazios do Letterboxd (`empty-poster`) são ignorados como capa.

## hub0.4
- Projeto renomeado para **Centro de Mídia** (título da janela, `<title>`, nome e descrição no manifest). Versão do manifest: 0.4.0.
- Nova aba **Configurações** (ícone de engrenagem na lateral, menu File e botão "Configurar"): Aparência, Listas e Dados salvos. Saíram do Início.
- Removidos o botão de fechar da barra de título e os 3 LEDs da barra de menu (e a opção "LEDs da barra").
- **Listas**: limite de itens por site, separado para o **Início** (0–20) e para a **aba do site** (5–60, de 5 em 5). A opção antiga "Itens por lista" não tinha efeito e foi removida.
- **Backloggd**: agora lê `/u/<usuario>/journal/activity/` (uma entrada por jogo, mais recentes primeiro) com data, situação (iniciado/finalizado) e nota em estrelas. Antes lia a seção "Recently Played" do perfil.
- **Cache e perfis**: os links dos perfis e os dados lidos ficam salvos no armazenamento da extensão (`perfis`, `cache2`). Cache com menos de 10 min não é baixado de novo ao abrir; "Atualizar" força. O status mostra "salvo há X min". Em Configurações → Dados salvos dá para ver o link de cada site e esquecer.
- Contador (stepper) ganhou passo configurável.

## hub0.3
- Código reescrito (`var` no topo, sem arrow functions/ternários/template strings).
- Removida a escrita de reviews (compositor, lista de reviews, painel de preenchimento) e a permissão do Google Books, percebi que isso precisaria que o usuario fizesse o login dos respectivos sites/apps.
- Configurações novas: tamanho dos pôsteres (4 níveis), pôsteres coloridos, links azuis, LEDs, fundo pontilhado, e por site: pôsteres e cores de status.

## hub0.2
- Interface retrô 1-bit (barra de menu, janela com título listrado, barra de rolagem pontilhada, ícones laterais) com Início + uma página por site.
- Leitura passiva da estante do Skoob novo (`/pt/user/<id>/bookshelf`) com status por progresso (vazio = não iniciado, <100% = lendo, 100% = lido).

## hub0.1
- Extensão única para Opera (service worker) e Firefox (background scripts); busca e criação de reviews; dashboard com Letterboxd (RSS), Backloggd e Skoob.
