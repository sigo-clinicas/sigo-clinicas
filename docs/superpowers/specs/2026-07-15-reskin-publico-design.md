# Reskin visual das telas públicas — fidelidade ao sistema antigo

Data: 2026-07-15
Status: aprovado pela liderança (plano + 4 decisões)

## Objetivo

Deixar as telas **públicas (pré-login)** do Sigo Clínicas novo visualmente
idênticas às do sistema antigo (`repositorio-antigo/sigo-clinicas-www`),
mantendo intacto o backend novo (Supabase Auth + marketplace S3).

É um trabalho de **aparência apenas**. Nenhuma regra de negócio muda.

## Regra absoluta — blindagem do ERP

Nada pós-login pode mudar. **Proibido tocar:**

- `src/app/painel/**`, `src/app/admin/**`
- `src/lib/**`, `supabase/**`
- Compartilhados com o painel: `src/app/layout.tsx`, `src/app/globals.css`,
  `tailwind.config.ts`
- `src/app/(publico)/**` — apesar do nome, é a anamnese por token (`noindex`),
  fora do escopo.

Se qualquer necessidade de tocar num arquivo compartilhado ou pós-login surgir
durante a execução: **PARAR e perguntar**.

## Descoberta que orienta a abordagem

O sistema antigo **não é PHP**. `sigo-clinicas-www` é **Next.js 7 +
styled-components + antd 3** (React 16, EOL). O PHP/MySQL vive em
`sigo-clinicas-api`, que não é tocada.

Consequência: o visual pode ser portado **literalmente** (CSS copiado), não
recriado de memória. É isso que garante o "pixel-a-pixel".

A landing descrita pela cliente (hero com busca especialidade+cidade, 3
segmentos, Como Funciona, seção do app, rodapé completo) é o
`components/HomeComponent`, servido em `/`. O `/landingpage` do antigo é outra
coisa — página B2B ("Soluções", "Programa de Parceiros", form de contato) — e
está **fora do escopo**. É justamente o destino atual do botão "Cadastrar
Clínica".

## Decisões (aprovadas)

1. **Filtros Data/Preço na busca** — o antigo tem Cidade, Especialidade, Data
   (DatePicker) e Preço (Slider). O marketplace novo (`listarClinicas`) só
   filtra cidade + especialidade; Data/Preço exigiriam mexer no backend.
   → Os 4 painéis são renderizados com o CSS idêntico, mas **Data e Preço ficam
   inertes com aviso "Em breve"**.
2. **Páginas legais** — `/termos`, `/privacidade`, `/cookies`, `/lgpd` são
   **portadas** (conteúdo estático do repo antigo, sem backend).
3. **Técnica de CSS** — **CSS Modules com o CSS copiado verbatim** dos
   `styles.js` antigos. Zero dependência nova, compatível com Server
   Components, impossível vazar estilo para o painel. Os poucos widgets antd
   (Select, Slider, Collapse, Checkbox) são reimplementados com as medidas
   exatas.
4. **Cadastro** — "Registre-se" (login) e "Cadastro" (rodapé) ficam **visíveis e
   inertes com "Em breve"**. Construir auto-cadastro de paciente criaria
   superfície nova de backend — fora do escopo.

Extras aprovados:

- **Banner de cookies** da home antiga: incluído (client-side puro, grava cookie
  de consentimento, sem backend).
- **react-slick + slick-carousel**: aprovados para reproduzir os carrosséis com
  o CSS slick original e as mesmas `settings`. **Restrição:** só podem ser
  importados por `src/components/publico/*` — nunca por arquivo do painel/ERP.
  A ausência no bundle do painel deve ser provada ao fim.

## Botão "Cadastrar Clínica"

Aparece no topo de todas as telas antigas. O fluxo de cadastro de clínica **não
será construído** (decisão futura da cliente).

Solução: manter o **CSS vermelho idêntico**, porém renderizar como
`<button aria-disabled>` (não `<a href="/landingpage">`, que seria link morto
para rota inexistente) e, no clique, exibir um popover "Em breve". Mesma
mecânica para os demais links sem destino.

## Escopo — arquivos

### Novos (nenhum compartilhado com o ERP)

- `src/components/publico/` → `sticky.tsx`, `footer.tsx`, `public-shell.tsx`,
  `hero-slider.tsx`, `clinicas-slider.tsx`, `em-breve.tsx`, `cookie-banner.tsx`
  + `.module.css` correspondentes
- `src/app/termos/`, `src/app/privacidade/`, `src/app/cookies/`,
  `src/app/lgpd/` → 4 `page.tsx` estáticas
- `public/static/` → assets originais

### Alterados (todos pré-login)

- `src/app/page.tsx` (home)
- `src/app/buscar/page.tsx`
- `src/app/(auth)/layout.tsx` (shell visual; mantém `redirect("/painel")`)
- `src/app/(auth)/login/page.tsx` + `login-form.tsx`
- `src/app/(auth)/recuperar-senha/`, `src/app/(auth)/redefinir-senha/`
- `src/app/clinica/[slug]/page.tsx` + `agendar/page.tsx`

## Assets

De `repositorio-antigo/sigo-clinicas-www/static/` → `sigo-clinicas/public/static/`,
**mantendo o mesmo caminho** para que as referências (`/static/logo.svg`,
`/static/app.png`) funcionem verbatim e o markup possa ser copiado sem
reescrita.

Incluídos: `logo.svg`, `logo_cinza.svg`, `favicon.ico`, `app.png`,
`icon_buscar.png`, `icon_escolha.png`, `icon_agende.png`, `img_slide_1-3.png`,
`dentista.jpg`, `pacient.jpg`, `search.svg`, `clinicapereda.png`.

Excluídos: `static/antd/` e `static/slick/` (bundles de vendor EOL — o grosso
dos 45 MB). O CSS do slick vem do pacote npm `slick-carousel`.

**Fontes:** Ubuntu (400/500/700) via `next/font/google`, aplicada **dentro do
`PublicShell`**, nunca no `layout.tsx`/`globals.css` (que são do painel também).
O `globals.css` tem `body { @apply font-inter }`; a Ubuntu no wrapper vence pela
cascata sem alterar o painel.

**Ícones:** Font Awesome (`fab fa-apple`, `fab fa-android`, social do rodapé) e
os `Icon` do antd viram **SVG inline** — sem CDN externa.

## Ligação com o backend novo

Só a camada de apresentação muda. As chamadas continuam sendo `listarClinicas()`,
`listarCidades()`, `listarEspecialidades()`, `clinicasDestaque()` de
`@/lib/marketplace` (Supabase + RLS), e o `LoginForm` segue no Supabase Auth.

**Proibido** reintroduzir: `services/api.js`, axios, OAuth do Laravel, cookies
`app.access_token`. Copia-se JSX e CSS — nunca data-fetching.

O `ClinicasSlider` antigo fazia `api.get('/clinicas?page_size=8')` → passa a
consumir `clinicasDestaque(8)`.

**URL da busca:** o antigo usava `/{especialidade}/{cidade}/{idsegmento}`; a nova
mantém `/buscar?cidade=&especialidade=` (a antiga exigiria rotas novas e
quebraria o form GET/SEO). Os 3 botões de segmento apontam para `/buscar` com o
filtro aplicado.

## Fases (vertical slices, uma PR por fase, CI verde)

1. **Assets** — copiar `static/` → `public/static/`; Ubuntu via `next/font`.
2. **Shell** — `Sticky` + `Footer` verbatim; "Cadastrar Clínica" inerte.
3. **Home `/`** — hero + busca, 3 segmentos, sliders ligados ao marketplace,
   seção do app, Como Funciona, banner de cookies.
4. **`/buscar`** — layout antigo; Cidade/Especialidade ligados; Data/Preço
   inertes.
5. **`/login` + `(auth)/*`** — visual antigo, Supabase Auth intacto.
6. **`/clinica/[slug]` + `/agendar`** — visual do `DetalhesComponent`.
7. **4 páginas legais** — conteúdo estático portado.

## Verificação final

- `npm run build` + `npm run typecheck` verdes.
- Comparação visual lado a lado com o antigo (`node server.js`), **desktop e
  mobile**.
- **Prova de ERP intacto:** `git diff origin/main --stat` não pode listar
  nenhum caminho de `src/app/painel/`, `src/app/admin/`, `src/lib/`,
  `supabase/`, `src/app/layout.tsx`, `src/app/globals.css`,
  `tailwind.config.ts`. Mais screenshot do `/painel` antes/depois.
- **Prova de bundle:** `react-slick`/`slick-carousel` só importados em
  `src/components/publico/*`; ausentes do bundle do painel.

## Commits

`feat(publico-*)`. Sem reescrita de histórico.
