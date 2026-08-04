export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. 公共 7 天留言列表 API (/api/archive)
    if (pathname === '/api/archive') {
      const cacheUrl = new URL(request.url);
      const cacheKey = new Request(cacheUrl.toString(), request);
      const cache = caches.default;
      
      let response = await cache.match(cacheKey);
      if (!response) {
        const supabaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/active_statements?select=*`, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
          }
        });

        const data = await supabaseRes.json();
        response = new Response(JSON.stringify(data), {
          headers: {
            'content-type': 'application/json;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60, s-maxage=60'
          }
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    }

    // 2. 单件服装 JSON API (/api/garment/0001 - /api/garment/0777)
    const apiGarmentMatch = pathname.match(/^\/api\/garment\/(\d{4})\/?$/);
    if (apiGarmentMatch) {
      const serialNum = Number(apiGarmentMatch[1]);
      if (serialNum < 1 || serialNum > 777) {
        return new Response(JSON.stringify({ error: "NUMBER NOT ISSUED" }), { status: 404 });
      }

      const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_garment_state`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_serial: serialNum })
      });

      const garmentData = await rpcRes.json();
      return new Response(JSON.stringify(garmentData), {
        headers: { 'content-type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 3. 独立 HOW IT WORKS 页面 (/how-it-works)
    if (pathname === '/how-it-works' || pathname === '/how-it-works/') {
      return env.ASSETS.fetch(new Request(`${url.origin}/how-it-works.html`));
    }

    // 4. NFC 认领落地网页分流 (/g/0001 - /g/0777) -> 返回 garment.html 模板
    const htmlRouteMatch = pathname.match(/^\/g\/(\d{4})\/?$/);
    if (htmlRouteMatch) {
      const serialNum = Number(htmlRouteMatch[1]);
      if (serialNum < 1 || serialNum > 777) {
        return new Response("NUMBER NOT ISSUED", { status: 404 });
      }
      return env.ASSETS.fetch(new Request(`${url.origin}/garment.html`));
    }

    // 5. 超出范围的非法路径直接拦截 404 (如 /g/9999)
    if (pathname.startsWith('/g/')) {
      return new Response("NUMBER NOT ISSUED", { status: 404 });
    }

    // 6. 其余静态资源 (index.html, front.png, LOGO.png 等) 正常穿透
    return env.ASSETS.fetch(request);
  }
};
