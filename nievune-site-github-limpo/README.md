# Nievune — pacote limpo para GitHub Pages

Este pacote é **estático** e não usa React, Vite, TanStack, Node, `node_modules`, build ou arquivos do Lovable.

## Publicar

1. Extraia o ZIP.
2. Envie **o conteúdo interno** para a raiz do repositório.
3. No GitHub: **Settings → Pages → Deploy from a branch → main / root**.
4. Aguarde a publicação.

O arquivo principal é `index.html` e já está na raiz.

## Arquivos do site

- `index.html` — loja pública
- `styles.css` — visual
- `storefront.js` — produtos, busca, favoritos, carrinho e detalhes
- `auth.js` — conta do cliente e favoritos sincronizados
- `products.local.json` — catálogo inicial
- `assets/` — apenas imagens realmente usadas
- `manage-nievune.html` + `manage.js` — gerenciador privado
- `config.js` — configuração do Supabase
- `setup/SUPABASE_SETUP.sql` — banco, login, favoritos e segurança

## Login e painel privado

Sem Supabase configurado, a loja pública abre normalmente, mas o gerenciador fica bloqueado.

Para ativar:

1. Crie um projeto no Supabase.
2. Execute `setup/SUPABASE_SETUP.sql` no SQL Editor.
3. Cole o Project URL e a chave pública anon em `config.js`.
4. Configure a URL publicada em **Authentication → URL Configuration**.
5. Crie sua conta pela loja e registre o seu usuário como administrador conforme os comentários do SQL.

## Links de compra e vídeos

Os campos continuam vazios para você inserir depois pelo gerenciador privado.
