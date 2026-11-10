# SuperMartket

## Acessar aplicação

[**Abrir SuperMartket no GitHub Pages**](https://arthurnunesdev.github.io/SuperMartket/)

Aplicativo mobile-first para organizar compras de supermercado em uma lista compartilhada entre os dispositivos da família.

## Funcionalidades

- Acesso protegido por PIN familiar de seis dígitos.
- Identificação pelo nome, salva no próprio dispositivo.
- Lista de compras compartilhada em tempo real.
- Registro de quem adicionou cada produto.
- Cadastro, edição e exclusão de produtos.
- Cálculo automático de subtotais e total.
- Finalização de compras e histórico compartilhado.
- Tema claro e escuro.
- PWA com app shell disponível offline após o carregamento inicial.

## Arquitetura

- React e Vite no frontend.
- GitHub Pages para hospedagem do frontend.
- Supabase Auth com sessão anônima persistente por dispositivo.
- Supabase Edge Function para validar o PIN no servidor.
- PostgreSQL com Row Level Security para compras e produtos.
- Supabase Realtime para sincronização entre dispositivos.

O PIN e a chave de rate limit ficam nos secrets da Edge Function. A chave publishable do Supabase usada pelo frontend não concede acesso aos dados sem uma sessão autorizada e as políticas RLS.

## Configuração inicial do Supabase

1. Em **Authentication → Sign In / Providers**, habilite o provedor de acesso anônimo.
2. Em **Edge Functions → Secrets**, configure:
   - `FAMILY_PIN`: PIN familiar de exatamente seis dígitos.
   - `FAMILY_RATE_LIMIT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
3. Não configure `service_role` no frontend, no GitHub Pages ou em variáveis `VITE_*`. As variáveis padrão do Supabase são injetadas no ambiente da Edge Function.
4. A função `family-access` deve permanecer com verificação JWT habilitada.

Para gerar um segredo aleatório no PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

A lista compartilhada começa vazia. Dados que já existam no IndexedDB e no armazenamento local dos navegadores não são importados, apagados nem modificados por esta integração.

## Executar localmente

Requisitos: Node.js 20.19+ ou 22.12+ e npm.

```bash
npm install
npm run dev
```

## Testes e build

```bash
npm test
npm run build
npm run preview
```

## Publicação

O workflow de GitHub Actions publica o build no GitHub Pages quando alterações chegam à branch `main`.
