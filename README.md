# SuperMartket

## Acessar aplicação

[**Abrir SuperMartket no GitHub Pages**](https://arthurnunesdev.github.io/SuperMartket/)

Aplicativo mobile-first para registrar produtos durante as compras de supermercado e acompanhar o valor estimado em tempo real.

## Escopo atual

- Criar uma compra e registrar produtos.
- Informar quantidade, unidade e preço por unidade.
- Calcular subtotais e total automaticamente.
- Editar e remover produtos.
- Finalizar compras e consultar o histórico.
- Manter os dados localmente no dispositivo com IndexedDB.
- Instalar como PWA e disponibilizar o app shell para uso offline após o primeiro carregamento completo.

## Tecnologias

- React
- Vite
- JavaScript
- CSS
- IndexedDB
- Progressive Web App (PWA)

## Requisitos

- Node.js 20.19+ ou 22.12+.
- npm.

## Executar localmente

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

## Armazenamento

As compras ficam no IndexedDB do navegador e não são enviadas para um servidor. Os dados pertencem ao navegador e ao dispositivo utilizados. Limpar os dados do navegador ou perder o dispositivo pode apagar as compras.

O MVP não possui sincronização entre dispositivos nem backup em nuvem.
