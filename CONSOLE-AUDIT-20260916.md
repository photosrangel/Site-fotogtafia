# Auditoria do Console — 16/09/2026

- Desativado o prefetch explícito da navegação pública. O prefetch das rotas fazia o React/Next antecipar recursos de páginas ainda não abertas (ex.: `/sobre`), originando avisos de `retrato-01.jpg` e `legacy/css/style.css` preloaded but not used na página atual.
- Removida a segunda inclusão de `/legacy/css/style.css` da rota `/area-cliente`; o CSS já é carregado pelo layout raiz.
- O erro React #418 não foi mascarado com `suppressHydrationWarning`: o código auditado não mostrou renderização inicial baseada em `Math.random`, `Date.now`, `window` ou `localStorage` fora de efeitos. O print fornecido mostra tradução automática do navegador ativa, que pode modificar o DOM antes da hidratação e produzir #418. Deve ser confirmado em produção com tradução/extensões desativadas antes de atribuir o erro ao app.
- A instalação de dependências/build no ambiente de auditoria não concluiu dentro do limite; não foi alegada validação de build.
