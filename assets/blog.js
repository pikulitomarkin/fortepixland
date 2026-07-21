window.FortePixBlog = (function () {
  const API_URLS = [
    '/api/blog/posts',
    '/blog/api/posts',
    '/blog/data/posts.json',
  ];

  async function fetchPosts(options = {}) {
    const { slug, category, tag, page = 1, limit = 20 } = options;
    const params = new URLSearchParams();
    if (slug) params.set('slug', slug);
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();

    for (const base of API_URLS) {
      try {
        const url = qs ? `${base}?${qs}` : base;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();

        if (slug) {
          if (data.post) return data;
          const post = (data.posts || []).find((p) => p.slug === slug && p.status === 'published');
          if (post) return { post, version: data.version, updatedAt: data.updatedAt };
        }

        if (data.posts) {
          const published = data.posts.filter((p) => p.status === 'published');
          return { ...data, posts: published };
        }
      } catch (_) {
        /* try next */
      }
    }
    throw new Error('Não foi possível carregar os posts');
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function estimateReadingTime(content) {
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  function initHeader() {
    const burger = document.getElementById('burger');
    if (!burger) return;
    burger.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.mobile-menu a').forEach((a) => {
      a.addEventListener('click', () => {
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function renderMarkdown(md) {
    if (typeof marked !== 'undefined') {
      return marked.parse(md, { breaks: true });
    }
    return md
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hubl])/gm, (line) => (line.trim() ? `<p>${line}</p>` : ''));
  }

  return {
    fetchPosts,
    formatDate,
    slugify,
    estimateReadingTime,
    initHeader,
    renderMarkdown,
  };
})();
