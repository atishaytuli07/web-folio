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
      var current = root.getAttribute("data-theme");
      apply(current === "dark" ? "light" : "dark");
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
