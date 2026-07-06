/* Analytics bootstrap - external so CSP script-src can drop 'unsafe-inline'.
 *
 * Loaded from AnalyticsProvider only after the visitor accepts the consent
 * banner. IDs travel on data-* attributes of the loader tag so the same
 * file works across environments without inline substitution.
 *
 *   <script src="/analytics-init.js"
 *           data-ga4-id="G-XXX"
 *           data-meta-pixel-id="1234"></script>
 *
 * Either or both may be empty - the file silently skips whichever tag is
 * unconfigured.
 */
(function () {
  var self = document.currentScript;
  if (!self) return;
  var ga4Id = self.getAttribute('data-ga4-id') || '';
  var metaId = self.getAttribute('data-meta-pixel-id') || '';

  if (ga4Id) {
    // GA4 loader + config. The gtag.js runtime is loaded separately by the
    // <Script src="…googletagmanager.com/gtag/js?id=…"> tag in the provider.
    var dl = (window.dataLayer = window.dataLayer || []);
    function gtag() { dl.push(arguments); }
    window.gtag = window.gtag || gtag;
    gtag('js', new Date());
    gtag('config', ga4Id, { anonymize_ip: true, send_page_view: true });
  }

  if (metaId) {
    // Meta Pixel bootstrap - verbatim from Meta's provided snippet with
    // the ID substituted from data-meta-pixel-id.
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', metaId);
    window.fbq('track', 'PageView');
  }
})();
