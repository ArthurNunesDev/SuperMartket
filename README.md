# SuperMartket

Aplicação web para organizar compras de supermercado em uma lista compartilhada entre familiares, com sincronização em tempo real.

[**Acessar o SuperMartket**](https://arthurnunesdev.github.io/SuperMartket/)

## Funcionalidades

- Acesso à sessão familiar por PIN e identificação do participante.
- Lista de compras compartilhada e sincronizada em tempo real.
- Cadastro, edição e remoção de produtos planejados.
- Identificação inteligente de possíveis duplicidades, inclusive com erros comuns de digitação.
- Sugestões automáticas de produtos frequentes com base no histórico disponível.
- Carrinho com quantidades, preços, subtotais e total da compra.
- Histórico de compras com busca, detalhes dos itens e resumo de gastos.
- Edição do nome do participante neste dispositivo.
- Tema claro e escuro.
- Interface instalável e suporte básico para acesso offline à estrutura da aplicação.

## Tecnologias

- **Frontend:** React 19 e Vite 7.
- **Backend:** Supabase (Autenticação, PostgreSQL, Edge Functions e Realtime).
- **Hospedagem:** GitHub Pages.

## Executar localmente

Requisitos: Node.js e npm.

```bash
git clone https://github.com/ArthurNunesDev/SuperMartket.git
cd SuperMartket
npm install
npm run dev
```

## Validação

Executar os testes automatizados e gerar o build de produção:

```bash
npm test
npm run build
```

## Backend

O funcionamento compartilhado depende do projeto Supabase e de suas configurações de autenticação, políticas de acesso (RLS), funções e migrations. As credenciais públicas do cliente são configuradas em `src/services/supabase.js`; chaves privilegiadas e segredos devem permanecer exclusivamente no ambiente seguro do backend.
