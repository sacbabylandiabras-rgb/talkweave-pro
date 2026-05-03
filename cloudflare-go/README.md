# Worker do dominio go.zaplynxpro.online

Este Worker da Cloudflare responde pelas rotas publicas:

- `GET /invite/:slug` -> consulta a edge function `redirect-link` no Supabase e redireciona o usuario.
- `GET /r?url=...&...` -> registra o clique via `track-flow-click` e redireciona para a URL final.
- Qualquer outra rota retorna uma pagina simples de "Link nao encontrado".

## Deploy (uma vez)

```bash
cd cloudflare-go
npx wrangler login
npx wrangler deploy
```

Depois, no painel da Cloudflare:

1. Workers & Pages -> selecione `go-zaplynxpro`.
2. Settings -> Triggers -> **Custom Domains** -> adicione `go.zaplynxpro.online`.
3. Garanta que nao exista nenhum outro Worker / Pages / DNS Worker Route capturando esse hostname.

## Atualizando

Edite `src/worker.js` e rode `npx wrangler deploy` novamente. Nao depende de redeploy do Vercel.