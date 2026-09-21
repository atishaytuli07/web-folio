/* ---------------------------------------------------------------
   /typography — type pairings found on sites worth studying.

   Each row is a SITE: its heading face over its body face, so the
   pairing is judged as a pair. Two honest constraints shape this:

   1) The faces live on different servers. Each declares a `source`
      (google | fontshare) and the loader picks the right CDN.
   2) Most of the best-set sites use COMMERCIAL type, which can't be
      re-served. Those rows name the faces and link to the foundry
      rather than faking the look in a substitute.

   Faces load lazily per row via IntersectionObserver, so you only
   pay for the pairings you actually scroll to.
--------------------------------------------------------------- */
(function () {
  "use strict";

  var list = document.getElementById("list");
  var specimenEl = document.getElementById("specimen-text");
  var sizeEl = document.getElementById("size");
  var sizeVal = document.getElementById("size-val");
  var filtersEl = document.getElementById("filters");
  if (!list) return;

  var DEFAULT_TEXT = "Aail1jgx";
  var BODY_TEXT =
    "Good type is invisible until you look for it. Then it is the only thing you can see.";

  var pairs = [];
  var state = { filter: "all", text: DEFAULT_TEXT, size: 56 };
  var loaded = Object.create(null);

  // Carry over whatever theme the portfolio last stored.
  try {
    var savedTheme = localStorage.getItem("folio-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  } catch (e) {}

  function debounce(fn, ms) {
    var t = 0;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  /* ---------- loading a single face ---------- */
  function hrefFor(face) {
    if (face.source === "google") {
      return "https://fonts.googleapis.com/css2?family=" + face.family + "&display=swap";
    }
    if (face.source === "fontshare") {
      return "https://api.fontshare.com/v2/css?f[]=" + face.family + "&display=swap";
    }
    return null;
  }

  function loadFace(face) {
    if (!face || !face.source) return; // commercial: nothing to load
    var key = face.source + ":" + face.family;
    if (loaded[key]) return;
    loaded[key] = true;
    var href = hrefFor(face);
    if (!href) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadPair(pair) {
    if (!pair || pair.status !== "free") return;
    loadFace(pair.heading);
    loadFace(pair.body);
  }

  /* ---------- local-only licensed faces ----------
     Licensed type can't ship on the public site, so those rows render
     name-only by default. If the matching .woff2 exists in
     ./fonts-local/ (gitignored, this machine only) the row silently
     upgrades to a real specimen. Missing file -> unchanged, no error. */
  // Only ever attempt local faces on a dev host. In production this is a
  // no-op, so the deployed page makes zero requests for files that were
  // never shipped (and logs zero 404s).
  var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(location.hostname) ||
                 location.protocol === "file:";

  function tryLocal(pair, row) {
    if (!IS_LOCAL || !window.FontFace || !document.fonts) return;
    var faces = [pair.heading, pair.body].filter(function (f) { return f && f.local; });
    if (!faces.length) return;

    Promise.all(
      faces.map(function (f) {
        var family = f.stack.replace(/'/g, "");
        var ff = new FontFace(family, "url('./fonts-local/" + f.local + "')");
        return ff
          .load()
          .then(function (done) { document.fonts.add(done); return true; })
          .catch(function () { return false; });
      })
    ).then(function (results) {
      if (!results.some(Boolean)) return;                 // nothing on disk
      var slot = row.querySelector(".specimen");
      if (!slot) return;
      slot.innerHTML =
        '<p class="spec-head" style="font-family:' + esc(pair.heading.stack) + ',system-ui,sans-serif">' +
        esc(state.text || DEFAULT_TEXT) + "</p>" +
        '<p class="spec-body" style="font-family:' + esc(pair.body.stack) + ',system-ui,sans-serif">' +
        esc(BODY_TEXT) + "</p>";
      row.setAttribute("data-local", "true");
    });
  }

  function findPair(id) {
    for (var i = 0; i < pairs.length; i++) if (pairs[i].id === id) return pairs[i];
    return null;
  }

  var io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            for (var i = 0; i < entries.length; i++) {
              if (!entries[i].isIntersecting) continue;
              var row = entries[i].target;
              io.unobserve(row);
              var p = findPair(row.getAttribute("data-id"));
              if (p && p.status === "free") loadPair(p);
              else if (p) tryLocal(p, row);
            }
          },
          { rootMargin: "500px 0px" }
        )
      : null;

  /* ---------- render ---------- */
  var STATUS = { free: "Free", commercial: "Commercial", custom: "Bespoke" };

  function faceLink(face) {
    var name = esc(face.name);
    return face.get
      ? '<a href="' + esc(face.get) + '" target="_blank" rel="noopener noreferrer">' + name + "</a>"
      : name;
  }

  function rowHTML(p) {
    var free = p.status === "free";
    var headStyle = free ? ' style="font-family:' + esc(p.heading.stack) + ',system-ui,sans-serif"' : "";
    var bodyStyle = free ? ' style="font-family:' + esc(p.body.stack) + ',system-ui,sans-serif"' : "";

    // Free pairings get a live specimen. Licensed ones state the names
    // plainly — the status word already explains why there's no preview.
    var specimen = free
      ? '<p class="spec-head"' + headStyle + ">" + esc(state.text || DEFAULT_TEXT) + "</p>" +
        '<p class="spec-body"' + bodyStyle + ">" + esc(BODY_TEXT) + "</p>"
      : '<p class="spec-names">' + esc(p.heading.name) +
        '<span class="spec-plus">+</span>' + esc(p.body.name) + "</p>";

    return (
      '<li class="row" data-id="' + esc(p.id) + '" data-status="' + esc(p.status) + '">' +
        '<div class="row-head">' +
          '<a class="row-site" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(p.site) + '<span class="arr" aria-hidden="true">&#8599;</span></a>' +
          '<span class="status status--' + esc(p.status) + '">' + esc(STATUS[p.status] || p.status) + "</span>" +
        "</div>" +
        '<div class="specimen">' + specimen + "</div>" +
        '<p class="pairing"><span class="lbl">H</span>' + faceLink(p.heading) +
          '<span class="sep">/</span><span class="lbl">B</span>' + faceLink(p.body) + "</p>" +
      "</li>"
    );
  }

  function visible() {
    return state.filter === "free"
      ? pairs.filter(function (p) { return p.status === "free"; })
      : pairs;
  }

  function render() {
    var items = visible();
    list.innerHTML = items.map(rowHTML).join("");

    var rows = list.querySelectorAll(".row");
    for (var i = 0; i < rows.length; i++) {
      var p = findPair(rows[i].getAttribute("data-id"));
      if (!p) continue;
      if (io) { io.observe(rows[i]); continue; }
      if (p.status === "free") loadPair(p);
      else tryLocal(p, rows[i]);
    }
  }

  // Specimen edits touch text nodes only — no re-render.
  function updateSpecimens() {
    var text = state.text || DEFAULT_TEXT;
    var nodes = list.querySelectorAll(".spec-head");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
  }

  /* ---------- controls ---------- */
  specimenEl.addEventListener("input", debounce(function (e) {
    state.text = e.target.value;
    updateSpecimens();
  }, 120));

  sizeEl.addEventListener("input", function (e) {
    state.size = e.target.value;
    list.style.setProperty("--size", state.size + "px");
    sizeVal.textContent = state.size;
  });

  filtersEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".pill");
    if (!btn) return;
    state.filter = btn.getAttribute("data-filter");
    var pills = filtersEl.querySelectorAll(".pill");
    for (var i = 0; i < pills.length; i++) {
      pills[i].setAttribute("aria-pressed", String(pills[i] === btn));
    }
    render();
  });

  /* ---------- boot ----------
     The data is inlined in the page, so there is no second request and
     no HTML -> JS -> fetch waterfall before the first row paints. */
  try {
    pairs = JSON.parse(document.getElementById("pairings").textContent);
    list.style.setProperty("--size", state.size + "px");
    render();
  } catch (e) {
    list.innerHTML = '<li class="empty">Could not read the pairings.</li>';
  }
})();
