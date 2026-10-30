# Aline Martins Corretora

Clone frontend do site da Aline Martins Corretora, com páginas institucionais, catálogo de imóveis, detalhes, galeria, mapa e imagens locais.

## Rodar localmente

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 4173
```

## Publicação

O projeto está preparado para publicação no GitHub Pages por GitHub Actions. Cada push na branch `main` executa o build e publica automaticamente o conteúdo da pasta `dist`.

## Próxima evolução: painel pela planilha

A ideia registrada para a próxima fase está em [`docs/planilha-cms.md`](docs/planilha-cms.md). A proposta é usar Google Sheets como painel administrativo, Google Drive ou Cloudinary para imagens e Apps Script como API, sem banco de dados próprio.
