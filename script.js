// portfolio script

/* ----------------------------------------------------------------
   Dark mode toggle: system preference + manual override + persistence
---------------------------------------------------------------- */
(function () {
  "use strict";
  var KEY = "folio-theme";
  var btn = document.querySelector(".theme-toggle");
  var root = document.documentElement;

  function getPreferred() {
    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }

  apply(getPreferred());

  if (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      // Crossfade the whole page between themes (View Transitions API). It's a
      // GPU-composited snapshot fade, so it stays smooth regardless of how many
      // elements change color. Old browsers and reduced-motion get the instant
      // swap, which was the previous behavior.
      var reduce =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (document.startViewTransition && !reduce) {
        document.startViewTransition(function () { apply(next); });
      } else {
        apply(next);
      }
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      var saved;
      try { saved = localStorage.getItem(KEY); } catch (err) {}
      if (!saved) apply(e.matches ? "dark" : "light");
    });
  }
})();

/* ----------------------------------------------------------------
   Lenis smooth scroll  buttery inertia. Skipped for reduced motion;
   native scroll events still fire, so the scroll-driven bird keeps working.
---------------------------------------------------------------- */
(function () {
  "use strict";
  if (typeof Lenis === "undefined") return;
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  // autoRaf lets Lenis drive its own animation frame (official recommended
  // setup). Exposed on window for future use (lenis.scrollTo / stop / start).
  window.lenis = new Lenis({
    autoRaf: true,
    duration: 1.15,
    easing: function (t) {
      return Math.min(1, 1.001 - Math.pow(2, -10 * t));
    },
  });
})();

/*
   Live clock */
(function () {
  "use strict";
  const root = document.getElementById("clock");
  if (!root) return;

  const hEl = root.querySelector("[data-h]");
  const mEl = root.querySelector("[data-m]");
  const sEl = root.querySelector("[data-s]");
  const apEl = root.querySelector("[data-ampm]");

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function tick() {
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    hEl.textContent = pad(h);
    mEl.textContent = pad(now.getMinutes());
    sEl.textContent = pad(now.getSeconds());
    apEl.textContent = ampm;
  }

  tick();
  setInterval(tick, 1000);
})();

/*
   Hover preview image that follows the cursor  */
(function () {
  "use strict";
  // Only on devices with a real hovering pointer (mouse/trackpad). This skips
  // phones and tablets, where the follow-the-cursor preview makes no sense and
  // can stick on tap. The element below is never created on touch.
  if (
    !window.matchMedia ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches
  )
    return;

  const items = document.querySelectorAll(".project-item[data-preview]");
  if (!items.length) return;

  // Build the floating element once.
  const preview = document.createElement("div");
  preview.className = "hover-preview";
  preview.setAttribute("aria-hidden", "true");
  const inner = document.createElement("div");
  inner.className = "hover-preview__inner";
  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async"; // don't block the main thread while decoding
  inner.appendChild(img);
  preview.appendChild(inner);
  document.body.appendChild(preview);

  let targetX = 0,
    targetY = 0,
    curX = 0,
    curY = 0,
    raf = null,
    visible = false;

  function loop() {
    curX += (targetX - curX) * 0.18;
    curY += (targetY - curY) * 0.18;
    // Keep ticking only while there's distance left to close. When the cursor
    // stops, snap to the exact target and let the loop idle (start() restarts
    // it on the next mousemove)  no wasted 60fps frames while hovering still.
    if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
      preview.style.transform = "translate3d(" + curX + "px," + curY + "px,0)";
      raf = requestAnimationFrame(loop);
    } else {
      curX = targetX;
      curY = targetY;
      preview.style.transform = "translate3d(" + curX + "px," + curY + "px,0)";
      raf = null;
    }
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // If a screenshot is missing, don't show a broken/empty box.
  img.addEventListener("error", function () {
    preview.removeAttribute("data-show");
    visible = false;
  });

  items.forEach(function (item) {
    const src = item.getAttribute("data-preview");

    item.addEventListener("mouseenter", function (e) {
      img.src = src;
      // Snap to the cursor on first reveal so it doesn't fly in.
      targetX = curX = e.clientX;
      targetY = curY = e.clientY - 14;
      preview.setAttribute("data-show", "true");
      visible = true;
      start();
    });

    item.addEventListener("mousemove", function (e) {
      // The follow-the-cursor preview is centered on the pointer, so over the
      // small "Case study" link it would sit on top and hide it. Tuck the
      // preview away while the pointer is on that link so it stays visible and
      // clickable; re-show (snapped to the cursor, no fly-in) when leaving it.
      if (e.target.closest && e.target.closest(".case-study-link")) {
        if (visible) {
          preview.removeAttribute("data-show");
          visible = false;
        }
        return;
      }
      if (!visible) {
        preview.setAttribute("data-show", "true");
        visible = true;
        targetX = curX = e.clientX;
        targetY = curY = e.clientY - 14;
      } else {
        targetX = e.clientX;
        targetY = e.clientY - 14;
      }
      start();
    });

    item.addEventListener("mouseleave", function () {
      preview.removeAttribute("data-show");
      visible = false;
    });
  });
})();

/*
   "View all" toggles */
(function () {
  "use strict";
  const buttons = document.querySelectorAll(".show-more-btn[aria-controls]");
  Array.prototype.forEach.call(buttons, function (btn) {
    const ul = document.getElementById(btn.getAttribute("aria-controls"));
    if (!ul) return;
    const visible = parseInt(btn.getAttribute("data-visible"), 10) || 3;
    const items = ul.querySelectorAll(".project-item");
    const total = items.length;
    if (total <= visible) return; // nothing to collapse

    const hiddenCount = total - visible;
    const label = btn.querySelector(".show-more-label");

    function apply(collapsed) {
      for (let i = visible; i < total; i++) {
        items[i].classList.toggle("is-extra-hidden", collapsed);
      }
      btn.setAttribute("aria-expanded", String(!collapsed));
      label.textContent = collapsed
        ? "View all (" + hiddenCount + " more)"
        : "Show less";
    }

    btn.hidden = false;
    let collapsed = true;
    apply(true);

    btn.addEventListener("click", function () {
      collapsed = !collapsed;
      apply(collapsed);
    });
  });
})();

/*
   Carousel images */
(function () {
  "use strict";
  const imgs = document.querySelectorAll(".photo-scroller img");
  Array.prototype.forEach.call(imgs, function (img) {
    function hide() {
      img.style.display = "none";
    }
    img.addEventListener("error", hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });
})();

/*
   Sparrow: sits while you scroll (up or down); takes off and
   glides once you pause. */
(function () {
  "use strict";
  const bird = document.querySelector(".bird");
  if (!bird) return;
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const lift = bird.querySelector(".bird-lift");
  const sprite = bird.querySelector(".bird-sprite");

  const SPEED = 0.08; // px per ms (gentle glide)
  let x = -70;
  let flying = false;
  let lastT = 0;
  let raf = 0;
  let scrollTimer = 0;
  let vw = window.innerWidth;

  function paint() {
    bird.style.transform = "translate3d(" + x + "px,0,0)";
  }

  function tick(t) {
    let dt = t - lastT;
    lastT = t;
    if (dt > 50) dt = 50; // clamp (tab switch / throttle)
    x += SPEED * dt;
    if (x > vw + 80) x = -70; // wrap off-screen, no visible jump
    paint();
    raf = requestAnimationFrame(tick);
  }

  function startFly() {
    if (flying) return;
    flying = true;
    bird.classList.remove("is-sitting");
    lift.classList.add("is-up");
    sprite.classList.add("is-flying");
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function sit() {
    if (!flying) return;
    flying = false;
    cancelAnimationFrame(raf);
    raf = 0;
    lift.classList.remove("is-up");
    sprite.classList.remove("is-flying");
    bird.classList.add("is-sitting");
  }

  window.addEventListener(
    "scroll",
    function () {
      sit();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(startFly, 280);
    },
    { passive: true },
  );

  window.addEventListener(
    "resize",
    function () {
      vw = window.innerWidth;
    },
    { passive: true },
  );

  paint();
  startFly();
})();

/*
   Chat: copy email (button + press C) */
(function () {
  "use strict";
  const EMAIL = "atishaytuliiaf@gmail.com";
  const copyBtn = document.getElementById("copy-email");
  let toast;
  function showToast() {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "copy-toast";
      toast.textContent = "Email copied";
      document.body.appendChild(toast);
    }
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      toast.classList.remove("show");
    }, 1600);
  }
  function copyEmail() {
    if (navigator.clipboard)
      navigator.clipboard.writeText(EMAIL).catch(function () {});
    if (copyBtn) {
      const lbl = copyBtn.querySelector(".chat-btn-label");
      if (lbl) {
        const o = lbl.textContent;
        lbl.textContent = "Copied!";
        setTimeout(function () {
          lbl.textContent = o;
        }, 1400);
      }
    }
    showToast();
  }
  if (copyBtn) copyBtn.addEventListener("click", copyEmail);
  document.addEventListener("keydown", function (e) {
    if (
      (e.key === "c" || e.key === "C") &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      const tag = (
        e.target && e.target.tagName ? e.target.tagName : ""
      ).toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      copyEmail();
    }
  });
})();

/* ----------------------------------------------------------------
   Creative-coding video tiles
   reliable autoplay), pause off-screen, and honour reduced motion.
---------------------------------------------------------------- */
(function () {
  "use strict";
  const vids = document.querySelectorAll(".video-scroller video");
  if (!vids.length) return;
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // keep posters static, no autoplay

  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(vids, function (v) {
      v.play().catch(function () {});
    });
    return;
  }
  const io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.play().catch(function () {});
        } else {
          e.target.pause();
        }
      });
    },
    { threshold: 0.25 },
  );
  Array.prototype.forEach.call(vids, function (v) {
    io.observe(v);
  });
})();

/* ----------------------------------------------------------------
   GitHub contribution graph: fetch real public contributions on load
   and render them as a cobalt grid. On failure, keep the heading and
   link and just drop the graph (never hide the whole section).
---------------------------------------------------------------- */
(function () {
  "use strict";
  const graph = document.getElementById("gh-graph");
  if (!graph) return;
  const section = graph.closest(".gh-activity");
  fetch("https://github-contributions-api.jogruber.de/v4/atishaytuli07?y=last")
    .then(function (r) {
      if (!r.ok) throw 0;
      return r.json();
    })
    .then(function (data) {
      const days = (data && data.contributions) || [];
      if (!days.length) throw 0;
      const first = new Date(days[0].date + "T00:00:00");
      const pad = first.getDay();
      const frag = document.createDocumentFragment();
      for (let i = 0; i < pad; i++) {
        const e = document.createElement("span");
        e.className = "gh-cell gh-pad";
        frag.appendChild(e);
      }
      days.forEach(function (d) {
        const c = document.createElement("span");
        c.className = "gh-cell gh-l" + (d.level || 0);
        c.setAttribute("title", d.count + " on " + d.date);
        frag.appendChild(c);
      });
      graph.appendChild(frag);
    })
    .catch(function () {
      graph.style.display = "none";
      if (section) {
        const foot = section.querySelector(".gh-foot");
        if (foot) foot.style.display = "none";
        // no wall to peek over, so hide the pandas too
        const peeks = section.querySelectorAll(".gh-peek");
        for (let i = 0; i < peeks.length; i++) peeks[i].style.display = "none";
      }
    });
})();

/* ----------------------------------------------------------------
   Minimal / Creative mode toggle with a cross-fade on switch.
---------------------------------------------------------------- */
(function () {
  "use strict";
  const btns = document.querySelectorAll(".mode-btn");
  if (!btns.length) return;
  const shell = document.querySelector(".page-shell");
  function apply(mode) {
    document.body.classList.toggle("creative-mode", mode === "creative");
    Array.prototype.forEach.call(btns, function (b) {
      const on = b.getAttribute("data-mode") === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    try {
      localStorage.setItem("folio-mode", mode);
    } catch (e) {}
  }
  function set(mode, instant) {
    const already =
      document.body.classList.contains("creative-mode") ===
      (mode === "creative");
    if (instant || already || !shell) {
      apply(mode);
      return;
    }
    shell.classList.add("is-switching");
    setTimeout(function () {
      apply(mode);
      requestAnimationFrame(function () {
        shell.classList.remove("is-switching");
      });
    }, 250);
  }
  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener("click", function () {
      set(b.getAttribute("data-mode"));
    });
  });
  let saved = null;
  try {
    saved = localStorage.getItem("folio-mode");
  } catch (e) {}
  if (saved === "creative") set("creative", true);
})();

/* ----------------------------------------------------------------
   Creative mode: category folders open in place to reveal their work.
---------------------------------------------------------------- */
(function () {
  "use strict";
  const foldersEl = document.querySelector(".folders");
  const viewsEl = document.querySelector(".folder-views");
  if (!foldersEl || !viewsEl) return;
  function hideViews() {
    Array.prototype.forEach.call(
      viewsEl.querySelectorAll(".folder-view"),
      function (v) {
        v.setAttribute("hidden", "");
      },
    );
  }
  function showFolders() {
    hideViews();
    foldersEl.removeAttribute("hidden");
  }
  Array.prototype.forEach.call(
    document.querySelectorAll(".folder[data-cat]"),
    function (f) {
      f.addEventListener("click", function () {
        const view = viewsEl.querySelector(
          '.folder-view[data-cat="' + f.getAttribute("data-cat") + '"]',
        );
        if (!view) return;
        foldersEl.setAttribute("hidden", "");
        hideViews();
        view.removeAttribute("hidden");
        const t = view.querySelector(".fv-title");
        if (t) {
          t.setAttribute("tabindex", "-1");
          t.focus();
        }
      });
    },
  );
  Array.prototype.forEach.call(
    viewsEl.querySelectorAll(".fv-back"),
    function (b) {
      b.addEventListener("click", showFolders);
    },
  );
  Array.prototype.forEach.call(
    document.querySelectorAll('.mode-btn[data-mode="minimal"]'),
    function (b) {
      b.addEventListener("click", showFolders);
    },
  );
})();

/* ----------------------------------------------------------------
   Gold-mine "Receipts": notification cards slide in when scrolled to.
---------------------------------------------------------------- */
(function () {
  "use strict";
  const gm = document.querySelector(".gold-mine");
  if (!gm) return;
  if (!("IntersectionObserver" in window)) {
    gm.classList.add("is-revealed");
    return;
  }
  const io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          gm.classList.add("is-revealed");
          io.disconnect();
        }
      });
    },
    { threshold: 0.18 },
  );
  io.observe(gm);
})();

/* ----------------------------------------------------------------
   Split the creative name into letters so it can reveal on toggle.
---------------------------------------------------------------- */
(function () {
  "use strict";
  const name = document.querySelector(".ch-name");
  if (!name) return;
  const words = name.querySelectorAll("span");
  let idx = 0;
  Array.prototype.forEach.call(words, function (word) {
    const text = word.textContent;
    word.textContent = "";
    for (let i = 0; i < text.length; i++) {
      const c = document.createElement("span");
      c.className = "rv-char";
      c.textContent = text[i];
      c.style.setProperty("--i", idx++);
      word.appendChild(c);
    }
  });
})();

/* Folder stagger indices (for the cascade-in). */
(function () {
  "use strict";
  Array.prototype.forEach.call(
    document.querySelectorAll(".folders .folder"),
    function (f, i) {
      f.style.setProperty("--i", i);
    },
  );
})();

/* ----------------------------------------------------------------
   Subtle scroll parallax on the pixel clouds  a touch of depth as
   you scroll out of the hero. Off for reduced motion.
---------------------------------------------------------------- */
(function () {
  "use strict";
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const clouds = document.querySelectorAll(".cloud");
  if (!clouds.length) return;
  let ticking = false;
  function update() {
    const y = window.scrollY || window.pageYOffset || 0;
    for (let i = 0; i < clouds.length; i++) {
      // Drift gently down and a touch to the right as you scroll. The second
      // cloud's larger x-factor lets it lead, so they separate a little.
      clouds[i].style.transform =
        "translate3d(" +
        (y * (0.09 + i * 0.05)).toFixed(1) +
        "px," +
        (y * (0.14 + i * 0.07)).toFixed(1) +
        "px,0)";
    }
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
})();
/* ----------------------------------------------------------------
   Race track: a top-down oval racetrack on <canvas>, in the site's
   pixel-art language. The sprites are the hand-drawn pixel tortoise and
   rabbit (same rect data as the other pixel animals). The hare dashes
   ahead, naps just short of the checkered finish, and the tortoise plods
   past it to win. Field + track paint once to an offscreen buffer; each
   frame redraws only the two sprites. Paused off-screen, static frame for
   reduced motion, repainted on theme change.
---------------------------------------------------------------- */
(function () {
  "use strict";
  // tortoise 24x16, 15 rects |  rabbit 22x16, 37 rects
  var TPAL=["#7a8c5c","#6a7c4c","#94a878","#9a8860","#2c2c2c","#c4b890"];
  var TDAT=[[7.0,2.0,10.0,2.0,0],[5.0,4.0,14.0,2.0,0],[4.0,6.0,16.0,4.0,1],[5.0,10.0,14.0,2.0,0],[8.0,4.0,3.0,2.0,2],[13.0,4.0,3.0,2.0,2],[6.0,6.0,3.0,3.0,2],[10.0,6.0,4.0,3.0,2],[15.0,6.0,3.0,3.0,2],[20.0,5.0,3.0,4.0,3],[21.0,4.0,2.0,1.0,3],[22.0,6.0,1.0,1.0,4],[6.0,12.0,3.0,3.0,3],[15.0,12.0,3.0,3.0,3],[7.0,11.0,10.0,1.0,5]];
  /* Albino bunny, 16x16, facing right: two tall upright ears (back shaded,
     front white with pink inner), round head with a red eye + pink nose,
     slightly elongated fluffy body with belly highlight, tail shade, feet. */
  var RPAL=["#d9d4ca","#f3f2ee","#eeb9c4","#cf5d6e","#d97a86","#fbfaf6","#b8ae9e"];
  var RDAT=[[6,0,1,1,0],[7,0,1,1,1],[10,0,3,1,1],[6,1,1,1,0],[7,1,1,1,1],[10,1,1,1,1],[11,1,1,1,2],[12,1,1,1,1],[6,2,1,1,0],[7,2,1,1,1],[10,2,1,1,1],[11,2,1,1,2],[12,2,1,1,1],[6,3,1,1,0],[7,3,1,1,1],[10,3,1,1,1],[11,3,1,1,2],[12,3,1,1,1],[6,4,1,1,0],[7,4,1,1,1],[10,4,1,1,1],[11,4,1,1,2],[12,4,1,1,1],[6,5,2,1,0],[8,5,5,1,1],[5,6,8,1,1],[4,7,10,1,1],[4,8,8,1,1],[12,8,1,1,3],[13,8,2,1,1],[3,9,12,1,1],[15,9,1,1,4],[2,10,13,1,1],[1,11,1,1,0],[2,11,13,1,1],[0,12,1,1,0],[1,12,1,1,5],[2,12,4,1,1],[6,12,3,1,5],[9,12,6,1,1],[0,13,1,1,0],[1,13,1,1,5],[2,13,3,1,1],[5,13,5,1,5],[10,13,4,1,1],[1,14,1,1,0],[2,14,10,1,1],[12,14,1,1,6],[2,15,2,1,6],[10,15,2,1,6]];
  var wrap = document.querySelector(".race-track");
  if (!wrap) return;
  var canvas = wrap.querySelector(".race-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var bg = document.createElement("canvas");
  var bgc = bg.getContext("2d");
  var W = 0, H = 0, dpr = 1, geom = {}, SC = 1.4, raf = null, running = false, lastDraw = 0;
  var SPEED = 0.045, seed = 1;
  var reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pal() {
    var d = document.documentElement.getAttribute("data-theme") === "dark";
    return d
      ? { grass: "#333d1f", gd: "#2b341a", gl: "#3e4a28", sand: "#57523e", sd: "#4b4735", sl: "#645e46",
          specks: ["#7a5866", "#586a80", "#7a7248", "#9a978c", "#6f6382"],
          chk1: "#d9d5c8", chk2: "#3a3a3a", sh: "rgba(0,0,0,0.35)", z: "#a0a0a8" }
      : { grass: "#5c6c3d", gd: "#4e5e33", gl: "#697a47", sand: "#e8e1cd", sd: "#dbd2b8", sl: "#f3eddc",
          specks: ["#d98fa8", "#8fb0d9", "#e6d488", "#f2efe6", "#b9a6d4"],
          chk1: "#f3f2ee", chk2: "#2c2c2c", sh: "rgba(45,42,28,0.22)", z: "#787880" };
  }
  function stad(g, x, y, w, h) {
    var r = Math.min(h / 2, w / 2);
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  }
  function buildBG() {
    if (W <= 0 || H <= 0) return;
    var p = pal();
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgc.clearRect(0, 0, W, H);
    bgc.fillStyle = p.grass;
    bgc.fillRect(0, 0, W, H);
    seed = 98765;
    var i, gr = Math.floor((W * H) / 22);
    for (i = 0; i < gr; i++) {
      bgc.fillStyle = rnd() < 0.5 ? p.gd : p.gl;
      bgc.globalAlpha = 0.4 + rnd() * 0.4;
      bgc.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 2, 2);
    }
    bgc.globalAlpha = 1;
    var sp = Math.floor((W * H) / 900);
    for (i = 0; i < sp; i++) {
      bgc.fillStyle = p.specks[(rnd() * p.specks.length) | 0];
      bgc.globalAlpha = 0.55 + rnd() * 0.4;
      bgc.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 2, 2);
    }
    bgc.globalAlpha = 1;
    var g = geom;
    bgc.save();
    bgc.beginPath();
    stad(bgc, g.ox, g.oy, g.ow, g.oh);
    stad(bgc, g.ix, g.iy, g.iw, g.ih);
    bgc.fillStyle = p.sand;
    bgc.fill("evenodd");
    bgc.clip("evenodd");
    seed = 54321;
    var sg = Math.floor((W * H) / 16);
    for (i = 0; i < sg; i++) {
      bgc.fillStyle = rnd() < 0.5 ? p.sd : p.sl;
      bgc.globalAlpha = 0.4 + rnd() * 0.35;
      bgc.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 2, 2);
    }
    // checkered finish line across the bottom straight
    bgc.globalAlpha = 1;
    var fx = Math.round(g.clx + g.clw * 0.5),
      bw2 = g.bw,
      cell = Math.max(3, Math.round(bw2 / 6)),
      yTop = Math.round(g.oy + g.oh - bw2);
    for (var r2 = 0; r2 < Math.ceil(bw2 / cell); r2++)
      for (var c2 = 0; c2 < 2; c2++) {
        bgc.fillStyle = (r2 + c2) % 2 ? p.chk2 : p.chk1;
        bgc.fillRect(fx + c2 * cell - cell, yTop + r2 * cell, cell, Math.min(cell, bw2 - r2 * cell));
      }
    bgc.restore();
    // feather the field into the page: erase a soft gradient on each edge
    var fy = Math.max(8, Math.round(H * 0.09));
    var fxr = Math.max(12, Math.round(W * 0.028));
    bgc.globalCompositeOperation = "destination-out";
    var gt = bgc.createLinearGradient(0, 0, 0, fy);
    gt.addColorStop(0, "rgba(0,0,0,1)");
    gt.addColorStop(1, "rgba(0,0,0,0)");
    bgc.fillStyle = gt;
    bgc.fillRect(0, 0, W, fy);
    var gb = bgc.createLinearGradient(0, H, 0, H - fy);
    gb.addColorStop(0, "rgba(0,0,0,1)");
    gb.addColorStop(1, "rgba(0,0,0,0)");
    bgc.fillStyle = gb;
    bgc.fillRect(0, H - fy, W, fy);
    var gl = bgc.createLinearGradient(0, 0, fxr, 0);
    gl.addColorStop(0, "rgba(0,0,0,1)");
    gl.addColorStop(1, "rgba(0,0,0,0)");
    bgc.fillStyle = gl;
    bgc.fillRect(0, 0, fxr, H);
    var gright = bgc.createLinearGradient(W, 0, W - fxr, 0);
    gright.addColorStop(0, "rgba(0,0,0,1)");
    gright.addColorStop(1, "rgba(0,0,0,0)");
    bgc.fillStyle = gright;
    bgc.fillRect(W - fxr, 0, fxr, H);
    bgc.globalCompositeOperation = "source-over";
  }
  function posT(t) {
    var g = geom;
    var s = (((t % 1) + 1) % 1) * g.perim,
      rc = g.rc, cx = g.clx, cy = g.cly,
      topY = cy, botY = cy + g.clh,
      lCX = cx + rc, rCX = cx + g.clw - rc, mY = cy + rc;
    if (s < g.st) return { x: lCX + s, y: topY, d: 1 };
    s -= g.st;
    if (s < g.se) {
      var a = -Math.PI / 2 + s / rc;
      return { x: rCX + rc * Math.cos(a), y: mY + rc * Math.sin(a), d: a < Math.PI / 2 ? 1 : -1 };
    }
    s -= g.se;
    if (s < g.st) return { x: rCX - s, y: botY, d: -1 };
    s -= g.st;
    var a2 = Math.PI / 2 + s / rc;
    return { x: lCX + rc * Math.cos(a2), y: mY + rc * Math.sin(a2), d: a2 > Math.PI ? 1 : -1 };
  }
  // hare: dash ahead, nap just before the finish, wake late, arrive behind
  function rabT(p) {
    if (p < 0.26) return (p / 0.26) * 0.62;
    if (p < 0.8) return 0.62;
    return 0.62 + ((p - 0.8) / 0.2) * 0.36;
  }
  function sprite(dat, palA, x, y, flip, wPix, hPix, dy) {
    for (var i = 0; i < dat.length; i++) {
      var r = dat[i];
      var rx = flip ? wPix - r[0] - r[2] : r[0];
      ctx.fillStyle = palA[r[4]];
      ctx.fillRect(
        Math.round(x + (rx - wPix / 2) * SC),
        Math.round(y + (r[1] - hPix) * SC + dy),
        Math.ceil(r[2] * SC),
        Math.ceil(r[3] * SC)
      );
    }
  }
  function shadow(x, y, w, sh) {
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function zGlyph(x, y, s, col, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 3 * s, s);
    ctx.fillRect(x + s, y + s, s, s);
    ctx.fillRect(x, y + 2 * s, 3 * s, s);
    ctx.globalAlpha = 1;
  }
  function draw(tT, tR, time) {
    if (W <= 0) return;
    var p = pal();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pr = posT(tR), pt = posT(tT);
    var napping = tR === 0.62 && tT < 0.995;
    var hop = napping ? 0 : -Math.abs(Math.sin(time * 9)) * 3.5;
    var items = [[pr, "r"], [pt, "t"]];
    items.sort(function (A, B) { return A[0].y - B[0].y; });
    for (var i = 0; i < items.length; i++) {
      var P = items[i][0];
      if (items[i][1] === "t") {
        shadow(P.x, P.y, 24 * 0.9, p.sh);
        sprite(TDAT, TPAL, P.x, P.y, P.d < 0, 24, 16, Math.sin(time * 7) > 0 ? 0 : -1);
      } else {
        shadow(P.x, P.y, 16, p.sh);
        sprite(RDAT, RPAL, P.x, P.y, P.d < 0, 16, 16, hop);
        if (napping) {
          var t2 = time % 1.6,
            a = t2 < 0.8 ? t2 / 0.8 : 1 - (t2 - 0.8) / 0.8;
          zGlyph(P.x + 11, P.y - 16 * SC - 6, 2, p.z, 0.35 + a * 0.6);
          zGlyph(P.x + 17, P.y - 16 * SC - 12, 2.6, p.z, 0.25 + a * 0.5);
        }
      }
    }
  }
  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // Cap to ~30fps: the racers crawl (22s/lap), so 30 looks identical to 60
    // and halves the per-frame blit + fill work while the track is on screen.
    if (t - lastDraw < 32) return;
    lastDraw = t;
    var sec = t / 1000, ph = (sec * SPEED) % 1;
    draw(ph, rabT(ph), sec);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    if (W <= 0 || H <= 0) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    // smaller horizontal margin (wide track), larger vertical margin so the
    // cream oval is shorter and there's more grass above/below it.
    var mx = Math.round(H * 0.15), my = Math.round(H * 0.19), g = geom;
    g.ox = mx; g.oy = my; g.ow = W - 2 * mx; g.oh = H - 2 * my;
    var bw = Math.round(g.oh * 0.34);
    g.bw = bw;
    g.ix = mx + bw; g.iy = my + bw; g.iw = g.ow - 2 * bw; g.ih = g.oh - 2 * bw;
    g.clx = mx + bw / 2; g.cly = my + bw / 2; g.clw = g.ow - bw; g.clh = g.oh - bw; g.rc = g.clh / 2;
    g.st = g.clw - g.clh; g.se = Math.PI * g.rc; g.perim = 2 * g.st + 2 * g.se;
    SC = Math.max(1, Math.min(1.6, bw / 24));
    buildBG();
  }
  function staticFrame() { draw(0.86, 0.62, 0.4); }
  function start() { if (reduce || running || W <= 0) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  // Paint the offscreen field/track buffer (~8k fillRects) only when it's not
  // already sized to the element. First call builds; later calls are no-ops
  // unless the element resized.
  function ensureBuilt() {
    if (W === wrap.clientWidth && H === wrap.clientHeight && W > 0) return;
    if (!wrap.clientWidth) return;
    resize();
    if (reduce) staticFrame();
  }
  // Build the buffer right now, synchronously at script eval. The script is
  // deferred, so this runs after layout but BEFORE first paint  the ~8ms it
  // costs is invisible there. Deferring it anywhere later puts it in conflict
  // with something visible: inside the IntersectionObserver it stalled the
  // frame mid-scroll, and in an idle callback it fired during the staggerIn
  // entrance (0-1s after paint) and made the intro stutter. Pre-paint is the
  // one slot where this work can never drop a visible frame.
  ensureBuilt();

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (es) {
        for (var i = 0; i < es.length; i++) {
          if (es[i].isIntersecting) {
            ensureBuilt(); // normally a no-op (built pre-paint; rebuilds only if resized while hidden)
            start();
          } else stop();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(wrap);
  } else {
    ensureBuilt();
    if (!reduce) start();
  }

  if ("MutationObserver" in window) {
    var mo = new MutationObserver(function () { buildBG(); if (!running) staticFrame(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  var rz = null;
  window.addEventListener(
    "resize",
    function () { if (rz) clearTimeout(rz); rz = setTimeout(function () { resize(); if (!running) staticFrame(); }, 160); },
    { passive: true }
  );
})();
