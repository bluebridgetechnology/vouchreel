/*
 * Vouchreel collection form loader.
 * <script src="https://YOUR-APP/collect-embed.js" data-form="FORM_SLUG" async></script>
 * Inserts the form as an iframe with camera and microphone access granted (needed for in-form
 * video recording) and keeps the iframe as tall as the form. The embedding page must be HTTPS.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var slug = script.getAttribute("data-form");
  if (!slug) {
    console.error("[Vouchreel] collect-embed.js needs a data-form attribute");
    return;
  }

  var origin = new URL(script.src, window.location.href).origin;
  var iframe = document.createElement("iframe");
  iframe.src = origin + "/collect/" + encodeURIComponent(slug);
  iframe.title = script.getAttribute("data-title") || "Share your testimonial";
  iframe.setAttribute("allow", "camera; microphone");
  iframe.setAttribute("loading", "lazy");
  iframe.style.cssText = "width:100%;height:720px;border:0;display:block;color-scheme:normal";
  script.parentNode.insertBefore(iframe, script.nextSibling);

  window.addEventListener("message", function (event) {
    // Only trust resize messages from our own iframe
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || data.type !== "vouchreel:collect-resize" || typeof data.height !== "number") return;
    iframe.style.height = Math.min(Math.max(data.height, 200), 5000) + "px";
  });
})();
