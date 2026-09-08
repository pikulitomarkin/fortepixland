# Integração do App FortePix com o Blog

Guia para o agente/dev mobile consumir as publicações do blog no APK.

## Princípio

O app **não conecta no banco de dados**.  
Ele faz `GET` na API pública HTTPS; a API lê o PostgreSQL (Neon) e devolve JSON.

| Camada | Responsabilidade |
|--------|------------------|
| App (APK) | Chama HTTP e renderiza a lista/detalhe |
| API Vercel | Autentica nada (endpoint público), consulta o banco |
| Neon PostgreSQL | Armazena os posts publicados via CMS |

---

## Base URL

```
https://www.fortepixfinance.com
```

Se o domínio de produção mudar, atualize só a base — os paths abaixo permanecem iguais.

---

## Endpoint principal (usar no app)

### Listar publicações

```http
GET /api/blog/posts
```

Alias equivalente:

```http
GET /blog/api/posts
```

**Método:** `GET`  
**Auth:** nenhuma  
**CORS:** liberado (`Access-Control-Allow-Origin: *`)

### Query params

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `page` | int | `1` | Página (começando em 1) |
| `limit` | int | `20` | Itens por página (máx. **100**) |
| `category` | string | — | Filtra por categoria (case-insensitive) |
| `tag` | string | — | Filtra por tag |
| `slug` | string | — | Retorna **um** post específico |

### Exemplos prontos para o app

```text
# Todas as publicações (recomendado na home do blog no app)
GET https://www.fortepixfinance.com/api/blog/posts?limit=100

# Aba Educação Financeira
GET https://www.fortepixfinance.com/api/blog/posts?category=Educação%20Financeira&limit=100

# Aba Aprendendo com a FortePix
GET https://www.fortepixfinance.com/api/blog/posts?category=Aprendendo%20com%20a%20FortePix&limit=100

# Aba Canal Educativo
GET https://www.fortepixfinance.com/api/blog/posts?category=Canal_Educativo&limit=100

# Detalhe de um post
GET https://www.fortepixfinance.com/api/blog/posts?slug=edu-01-confira-sempre-o-destinatario
```

Alias de detalhe por path:

```text
GET https://www.fortepixfinance.com/blog/api/posts/{slug}
```

---

## Categorias (abas do app)

Use exatamente estes nomes no filtro `category` (URL-encoded):

| Aba no app | Valor de `category` |
|------------|---------------------|
| Educação Financeira | `Educação Financeira` |
| Aprendendo com a FortePix | `Aprendendo com a FortePix` |
| Canal Educativo | `Canal_Educativo` |

Sugestão de UX: chips/tabs com **Todos** (sem `category`) + as 3 categorias acima.

---

## Formato da resposta — lista

```json
{
  "source": "postgres",
  "updatedAt": "2026-07-22T16:00:00.000Z",
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 57,
    "totalPages": 1
  },
  "posts": [
    {
      "id": "edu-001",
      "slug": "edu-01-confira-sempre-o-destinatario",
      "title": "Confira sempre o destinatário",
      "excerpt": "Antes de confirmar um Pix...",
      "content": "## Dica 1\n\nAntes de confirmar um Pix...",
      "coverImage": "https://images.unsplash.com/...",
      "category": "Educação Financeira",
      "tags": ["educação financeira", "pix", "segurança", "fortepix"],
      "author": { "name": "Equipe FortePix" },
      "status": "published",
      "readingTimeMinutes": 2,
      "publishedAt": "2026-07-22T16:00:00.000Z",
      "updatedAt": "2026-07-22T16:00:00.000Z"
    }
  ]
}
```

### Campos importantes para a UI

| Campo | Uso no app |
|-------|------------|
| `title` | Título do card / tela |
| `excerpt` | Resumo na lista |
| `coverImage` | Imagem de capa (URL HTTPS) |
| `category` | Badge / filtro de aba |
| `publishedAt` | Data formatada (`dd/MM/yyyy`) |
| `readingTimeMinutes` | “X min de leitura” |
| `content` | Corpo do artigo (Markdown) |
| `slug` | ID de navegação / deep link |
| `source` | `"postgres"` = veio do banco; `"json"` = fallback |

A API pública só retorna posts com `status: "published"`.

---

## Formato da resposta — detalhe (`?slug=`)

```json
{
  "source": "postgres",
  "updatedAt": "2026-07-22T16:00:00.000Z",
  "post": {
    "id": "...",
    "slug": "...",
    "title": "...",
    "excerpt": "...",
    "content": "...",
    "coverImage": "...",
    "category": "...",
    "tags": [],
    "author": { "name": "Equipe FortePix" },
    "status": "published",
    "readingTimeMinutes": 2,
    "publishedAt": "...",
    "updatedAt": "..."
  }
}
```

Se o slug não existir: **HTTP 404**

```json
{ "error": "Post not found" }
```

---

## Conteúdo (`content`)

O campo `content` vem em **Markdown** (não HTML puro).  
No app, renderize com um parser Markdown (ex.: Markwon no Android).

Estrutura típica:

```markdown
## Título da seção

Parágrafo...

- Item 1
- Item 2

> Citação ou alerta
```

---

## Fluxo sugerido no APK

1. **Tela Blog / Publicações**
   - `GET /api/blog/posts?limit=100`
   - Guardar `posts` em memória/cache
   - Montar abas a partir das categorias (ou abas fixas da tabela acima)
2. **Filtro por aba**
   - Filtrar localmente por `category` **ou**
   - Refazer `GET` com `?category=...`
3. **Tela de detalhe**
   - Navegar com o objeto já carregado **ou**
   - `GET /api/blog/posts?slug={slug}`
4. **Cache (opcional)**
   - Usar `updatedAt` / `ETag` mental: se a lista não mudou, reutilizar cache local
5. **Offline**
   - Mostrar último JSON cacheado; avisar que pode estar desatualizado

### Headers recomendados

```http
Accept: application/json
```

Timeout sugerido: 15–30s (cold start serverless pode demorar um pouco).

---

## Exemplo Kotlin (Android)

```kotlin
// Listagem
val url = "https://www.fortepixfinance.com/api/blog/posts?limit=100"
val request = Request.Builder().url(url).get().build()

// Por categoria
val category = URLEncoder.encode("Educação Financeira", "UTF-8")
val urlCat =
  "https://www.fortepixfinance.com/api/blog/posts?category=$category&limit=100"

// Detalhe
val slug = "edu-01-confira-sempre-o-destinatario"
val urlDetail =
  "https://www.fortepixfinance.com/api/blog/posts?slug=$slug"
```

Parse do array: `response.posts`  
Parse do detalhe: `response.post`

---

## Endpoints que o APP NÃO deve usar

| Endpoint | Motivo |
|----------|--------|
| `GET /api/blog/admin/posts` | CMS — exige `Authorization: Bearer` |
| `POST /api/blog/save` | CMS — grava posts, exige login |
| `POST /api/auth/login` | Só para o painel admin web |
| Conexão direta ao Neon (`POSTGRES_URL`) | Credenciais não devem ir no APK |

---

## Checklist de integração

- [ ] Base URL de produção configurada
- [ ] Listagem com `GET /api/blog/posts?limit=100`
- [ ] Abas por `category` (Educação Financeira, Aprendendo com a FortePix, Canal_Educativo)
- [ ] Card: imagem, título, excerpt, data, categoria
- [ ] Detalhe: render Markdown de `content`
- [ ] Tratamento de erro de rede / 5xx / 404
- [ ] Sem credenciais de banco no app
- [ ] Confirmar `source: "postgres"` em produção após o deploy/seed

---

## Teste rápido (curl)

```bash
# Lista
curl -sS "https://www.fortepixfinance.com/api/blog/posts?limit=5" | jq '.source, .pagination, .posts[0].title, .posts[0].category'

# Categoria
curl -sS "https://www.fortepixfinance.com/api/blog/posts?category=Canal_Educativo&limit=5" | jq '.posts[].title'

# Detalhe
curl -sS "https://www.fortepixfinance.com/api/blog/posts?slug=golpe-inteligencia-artificial-deepfake" | jq '.post.title, .post.category'
```

---

## Observação sobre sincronização

Quando novos posts entram pelo CMS ou pelo `posts.json` no deploy, a API chama `seedIfEmpty` e sincroniza o Neon se os slugs do arquivo diferirem do banco.  
Para o app, isso é transparente: continue consumindo só `/api/blog/posts`.
