export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url query param", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (error) {
      return new Response("Invalid url query param", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const allowedHosts = new Set([
      "data.sba.gov",
      "api.sba.gov",
      "saedevadlsablob01.blob.core.windows.net",
    ]);

    if (!allowedHosts.has(targetUrl.hostname)) {
      return new Response("Only SBA Open Data hosts are allowed", {
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "census-sba-proxy",
      },
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};
