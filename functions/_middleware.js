// Runs on every request.
// 1. Preview addresses (*.pages.dev) stay out of search so they never compete with butlersmarinaannapolis.com.
// 2. Share previews need absolute URLs, so the og/twitter tags follow whatever host serves the page.
export async function onRequest({ request, next }) {
  const res = await next();
  const url = new URL(request.url);
  const preview = url.hostname.endsWith('.pages.dev');
  const type = res.headers.get('content-type') || '';

  if (!preview) return res;

  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!type.includes('text/html')) return out;

  const fix = (attr) => ({
    element(el) {
      const v = el.getAttribute(attr);
      if (v && v.startsWith('https://butlersmarinaannapolis.com')) el.setAttribute(attr, v.replace('https://butlersmarinaannapolis.com', url.origin));
    }
  });
  return new HTMLRewriter()
    .on('meta[property^="og:"]', fix('content'))
    .on('meta[name^="twitter:"]', fix('content'))
    .on('link[rel="canonical"]', fix('href'))
    .transform(out);
}
