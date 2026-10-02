# Testes e MVP

Aplicação React, Vite e TypeScript para acompanhar recrutamento de clientes, grupos, testes e rodadas.

## Desenvolvimento local

```powershell
npm install
npm run dev
```

Sem as variáveis Supabase, a aplicação mantém o modo local compatível com os dados existentes no `localStorage`.

## Supabase

1. Crie um projeto Supabase.
2. Aplique `supabase/migrations/20261001000000_initial_schema.sql` pelo SQL Editor.
3. Convide os usuários pelo Supabase Auth e mantenha o cadastro público desativado.
4. Insira o UUID de cada usuário autorizado em `public.workspace_members` pelo SQL Editor.
5. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. Cadastre as mesmas variáveis no ambiente da Vercel e publique novamente.

A aplicação exige login e só usuários listados em `workspace_members` passam pelas políticas RLS. A chave `service_role` não deve ser usada no frontend.

## Migração local

Após o login, se o navegador atual tiver dados locais e o Supabase estiver vazio, a aplicação mostra uma etapa de confirmação para migrá-los. Os dados do `localStorage` são mantidos após a cópia. Se ambos os lados já tiverem dados, a mesclagem automática é bloqueada para evitar duplicações silenciosas.

O `localStorage` é específico da origem. Os dados da publicação Vercel só aparecem ao executar a migração nessa origem. Consulte `supabase/README.md` para os detalhes de configuração e acesso inicial.
