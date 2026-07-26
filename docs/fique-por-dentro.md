# Canal Fique por Dentro — validação e operação

## O que é

Canal de **publicações diárias** sobre segurança bancária, golpes e fraudes no Brasil.

| Superfície | URL |
|------------|-----|
| Página pública | `https://fortepixfinance.com/fiquepordentro` |
| CMS (aba) | `/admin` → **Fique por Dentro** |
| API do app | `GET /api/blog/posts?category=Fique%20por%20Dentro&limit=100` |
| Detalhe | `/blog/post/{slug}` |

Categoria no banco: **`Fique por Dentro`**.

Cada publicação aceita **texto (Markdown)** + **imagens** (capa por URL e imagens inline no corpo).

---

## Validação da ideia com IA

### Veredito: **viável**, com revisão humana

Usar um modelo de IA para pesquisar e redigir alertas diários **funciona bem** neste stack, desde que a IA **não publique sozinha sem controles**.

### Por que funciona aqui

1. Já existe CMS + API + Neon — a IA só precisa gerar o post e gravar via `POST /api/blog/save` (autenticado) ou via rascunho no painel.
2. O app e a página leem o mesmo endpoint — uma publicação atende web e APK.
3. Markdown cobre texto + imagens (`![alt](url)`).
4. Publicação diária encaixa em cron (Vercel Cron / GitHub Actions / agente Cursor).

### Riscos (tratar com seriedade)

| Risco | Mitigação |
|-------|-----------|
| Alucinação (golpe inventado ou dado errado) | Exigir fontes reais (BACEN, polícia, imprensa) e revisão humana |
| Conteúdo defasado | Incluir data e “atualizado em” no texto |
| Imagens sem direito de uso | Usar Unsplash/Pexels licenciados, banco próprio ou geradas com licença clara |
| Tom alarmista / jurídico | Template editorial FortePix; evitar acusações a empresas sem base |
| Auto-publicação sem filtro | Fluxo padrão: IA gera **draft** → admin aprova → `published` |

### Arquitetura recomendada (fase 1 → fase 2)

**Fase 1 (agora — manual + IA assistida)**  
1. Operador pede à IA um rascunho do dia (tema: golpes/fraudes BR).  
2. Cola no CMS → aba **Fique por Dentro**.  
3. Ajusta texto/imagem → publica.

**Fase 2 (automação com aprovação)**  
1. Cron diário (ex.: 08:00 BRT).  
2. Job chama LLM com prompt + busca web (ou feeds confiáveis).  
3. Gera JSON do post com `status: "draft"`.  
4. Salva no Neon via API admin.  
5. Humano revisa no CMS e publica.

**Fase 3 (opcional — auto-publish controlado)**  
Só depois de métricas estáveis: auto-publish com checklist automático (fontes ≥ N, palavras-chave, sem PII, imagem válida).

### Prompt-base sugerido para o agente/IA

```text
Você é editor do canal "Fique por Dentro" da FortePix (Brasil).
Tema do dia: segurança bancária / golpes Pix / fraudes digitais no Brasil.
Regras:
- Use apenas informações com fontes públicas verificáveis; cite-as no texto.
- Se não houver fato novo confiável, escreva um alerta educativo genérico (não invente casos).
- Tom: claro, preventivo, sem sensacionalismo.
- Estrutura Markdown:
  ## O que aconteceu
  ## Sinais de alerta
  ## Como se proteger
  > Dica FortePix
- Inclua 1 URL de imagem de capa (Unsplash) relacionada.
- Gere também: title, excerpt, slug, tags, coverImage.
- Categoria fixa: "Fique por Dentro"
- status inicial: "draft"
```

### Imagens

Suportado hoje:

- **Capa:** campo URL no CMS (`coverImage`)
- **No texto:** botão “Inserir imagem” ou Markdown `![descrição](https://...)`

Upload de arquivo (multipart) ainda **não** está no produto — usar URLs públicas (CDN, Unsplash, storage).  
Próximo passo natural: Vercel Blob / S3 para upload direto no CMS.

---

## App mobile

O APK continua **sem acessar o banco**. Use:

```http
GET https://www.fortepixfinance.com/api/blog/posts?category=Fique%20por%20Dentro&limit=100
```

A WebView do app também pode abrir:

```text
https://fortepixfinance.com/fiquepordentro
```

Preferível API JSON para performance e controle de UI nativa.

---

## Operação no CMS

1. Entrar em `/admin`
2. Aba **Fique por Dentro**
3. **+ Novo artigo** (já nasce na categoria correta)
4. Preencher título, resumo, capa, conteúdo (texto + imagens)
5. Preview → **Publicar**

A aba **Blog** continua só com campanhas educativas (exclui Fique por Dentro).

---

## Checklist de go-live

- [ ] Deploy com rewrite `/fiquepordentro`
- [ ] Seed/sync Neon com posts da categoria
- [ ] App apontando para a URL ou para a API com `category=Fique por Dentro`
- [ ] Processo editorial diário definido (manual ou cron+draft)
- [ ] Fontes e política de imagens documentadas para o time/IA
