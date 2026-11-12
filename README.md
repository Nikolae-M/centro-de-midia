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
## hub0.3
- Código reescrito (`var` no topo, sem arrow functions/ternários/template strings).
- Removida a escrita de reviews (compositor, lista de reviews, painel de preenchimento) e a permissão do Google Books, percebi que isso precisaria que o usuario fizesse o login dos respectivos sites/apps.
- Configurações novas: tamanho dos pôsteres (4 níveis), pôsteres coloridos, links azuis, LEDs, fundo pontilhado, e por site: pôsteres e cores de status.

## hub0.2
- Interface retrô 1-bit (barra de menu, janela com título listrado, barra de rolagem pontilhada, ícones laterais) com Início + uma página por site.
- Leitura passiva da estante do Skoob novo (`/pt/user/<id>/bookshelf`) com status por progresso (vazio = não iniciado, <100% = lendo, 100% = lido).

## hub0.1
- Extensão única para Opera (service worker) e Firefox (background scripts); busca e criação de reviews; dashboard com Letterboxd (RSS), Backloggd e Skoob.
