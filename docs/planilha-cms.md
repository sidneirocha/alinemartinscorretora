# Ideia salva: painel de imóveis pela planilha

## Objetivo

Permitir que a corretora cadastre e atualize imóveis pelo Google Sheets, sem precisar editar código ou administrar um banco de dados.

## Arquitetura proposta

- Google Sheets: dados dos imóveis e controle de publicação.
- Apps Script: menu, formulário lateral, upload e API JSON.
- Google Drive, Cloudinary ou Cloudflare R2: armazenamento das imagens.
- Site: busca os imóveis publicados e mantém `content/properties.json` como fallback.

## Abas da planilha

### Imóveis

`id`, `slug`, `título`, `descrição`, `preço`, `área`, `quartos`, `banheiros`, `endereço`, `latitude`, `longitude`, `status`.

### Imagens

`imovel_id`, `ordem`, `url`, `alt`, `capa`.

Cada imóvel pode ter várias imagens. A ordem numérica é obrigatória: `1` é a capa, `2` é a segunda imagem, e assim por diante. O site deve ordenar sempre por `ordem` antes de montar a galeria.

## Fluxo para a corretora

1. Abrir o menu **Imóveis** dentro da planilha.
2. Criar ou editar um imóvel.
3. Adicionar imagens e reorganizar a ordem.
4. Salvar como rascunho ou publicar.
5. O site consumir automaticamente apenas os itens publicados.

## Decisões importantes

- Para começar: Google Drive + Sheets + Apps Script.
- Para mais tráfego: Cloudinary ou R2 para entregar imagens com CDN.
- Nunca colocar credenciais privadas no frontend.
- Validar que exista exatamente uma imagem marcada como capa por imóvel.
- Gerar o slug a partir do título, mas permitir edição manual para preservar links.
