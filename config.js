// CineVerse settings
//
// When the site runs on GitHub Pages, put your CURRENT tunnel address between the
// quotes below, for example: "https://abc-def-123.trycloudflare.com"
// (no slash at the end). When the tunnel address changes, only change this line.
//
// When the site runs on your own computer or directly through the tunnel,
// leave it empty.
(function () {
  var TUNNEL_ADDRESS = "https://sports-pool-plus-renaissance.trycloudflare.com";

  var base = "/jellyfin";
  if (TUNNEL_ADDRESS && /github\.io$/i.test(location.hostname)) {
    base = TUNNEL_ADDRESS.replace(/\/+$/, "") + "/jellyfin";
  }
  window.CINEVERSE_CONFIG = { proxyBase: base };
})();
