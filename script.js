// portfolio script

/* ---------------------------------------------------------------
   Live clock (matches Hamza's footer clock)
---------------------------------------------------------------- */
(function () {
  var root = document.getElementById("clock");
  if (!root) return;

  var hEl = root.querySelector("[data-h]");
  var mEl = root.querySelector("[data-m]");
  var sEl = root.querySelector("[data-s]");
  var apEl = root.querySelector("[data-ampm]");

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function tick() {
    var now = new Date();
    var h = now.getHours();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    hEl.textContent = pad(h);
    mEl.textContent = pad(now.getMinutes());
    sEl.textContent = pad(now.getSeconds());
    apEl.textContent = ampm;
  }

  tick();
  setInterval(tick, 1000);
})();

/* ---------------------------------------------------------------
   Hover preview image that follows the cursor on project rows
   (like Hamza's). Degrades gracefully: rows with no image, or a
   missing screenshot file, simply show no preview.
---------------------------------------------------------------- */
(function () {
  // Only on devices that actually hover (skip touch).
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) return;

  var items = document.querySelectorAll(".project-item[data-preview]");
  if (!items.length) return;

  // Build the floating element once.
  var preview = document.createElement("div");
  preview.className = "hover-preview";
  preview.setAttribute("aria-hidden", "true");
  var inner = document.createElement("div");
  inner.className = "hover-preview__inner";
  var img = document.createElement("img");
  img.alt = "";
  inner.appendChild(img);
  preview.appendChild(inner);
  document.body.appendChild(preview);

  var targetX = 0,
    targetY = 0,
    curX = 0,
    curY = 0,
    raf = null,
    visible = false;

  function loop() {
    curX += (targetX - curX) * 0.18;
    curY += (targetY - curY) * 0.18;
    preview.style.transform =
      "translate3d(" + curX + "px," + curY + "px,0)";
    if (visible || Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
      raf = requestAnimationFrame(loop);
    } else {
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
    var src = item.getAttribute("data-preview");

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
      targetX = e.clientX;
      targetY = e.clientY - 14;
      start();
    });

    item.addEventListener("mouseleave", function () {
      preview.removeAttribute("data-show");
      visible = false;
    });
  });
})();


/* ---------------------------------------------------------------
   "View all" toggles. Each .show-more-btn[aria-controls] points to
   a list id; data-visible sets how many items stay visible (default
   3). Progressive enhancement: with no JS, buttons stay hidden and
   all items are visible.
---------------------------------------------------------------- */
(function () {
  var buttons = document.querySelectorAll(".show-more-btn[aria-controls]");
  Array.prototype.forEach.call(buttons, function (btn) {
    var ul = document.getElementById(btn.getAttribute("aria-controls"));
    if (!ul) return;
    var visible = parseInt(btn.getAttribute("data-visible"), 10) || 3;
    var items = ul.querySelectorAll(".project-item");
    var total = items.length;
    if (total <= visible) return; // nothing to collapse

    var hiddenCount = total - visible;
    var label = btn.querySelector(".show-more-label");

    function apply(collapsed) {
      for (var i = visible; i < total; i++) {
        items[i].classList.toggle("is-extra-hidden", collapsed);
      }
      btn.setAttribute("aria-expanded", String(!collapsed));
      label.textContent = collapsed
        ? "View all (" + hiddenCount + " more)"
        : "Show less";
    }

    btn.hidden = false;
    var collapsed = true;
    apply(true);

    btn.addEventListener("click", function () {
      collapsed = !collapsed;
      apply(collapsed);
    });
  });
})();

/* ---------------------------------------------------------------
   Carousel images: hide any that fail to load so the page never
   shows a broken-image icon. Real files appear automatically once
   added to images/photos/.
---------------------------------------------------------------- */
(function () {
  var imgs = document.querySelectorAll(".photo-scroller img");
  Array.prototype.forEach.call(imgs, function (img) {
    function hide() {
      img.style.display = "none";
    }
    img.addEventListener("error", hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });
})();

/* ---------------------------------------------------------------
   Sparrow: sits while you scroll (up or down); takes off and
   glides once you pause. Performance: scroll handler only flips a
   flag + debounce; the rAF loop runs ONLY while flying (cancelled
   when sitting), uses GPU translate3d, caches innerWidth, and
   clamps dt so background-tab throttling never causes a jump.
---------------------------------------------------------------- */
(function () {
  var bird = document.querySelector(".bird");
  if (!bird) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var lift = bird.querySelector(".bird-lift");
  var sprite = bird.querySelector(".bird-sprite");

  var SPEED = 0.08; // px per ms (gentle glide)
  var x = -70;
  var flying = false;
  var lastT = 0;
  var raf = 0;
  var scrollTimer = 0;
  var vw = window.innerWidth;

  function paint() {
    bird.style.transform = "translate3d(" + x + "px,0,0)";
  }

  function tick(t) {
    var dt = t - lastT;
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

  window.addEventListener("scroll", function () {
    sit();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(startFly, 280);
  }, { passive: true });

  window.addEventListener("resize", function () {
    vw = window.innerWidth;
  }, { passive: true });

  paint();
  startFly();
})();


/* ---------------------------------------------------------------
   Chat: copy email (button + press C), contact form -> mailto.
---------------------------------------------------------------- */
(function () {
  var EMAIL = "atishaytuliiaf@gmail.com";
  var copyBtn = document.getElementById("copy-email");
  var toast;
  function showToast() {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "copy-toast";
      toast.textContent = "Email copied";
      document.body.appendChild(toast);
    }
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove("show"); }, 1600);
  }
  function copyEmail() {
    if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).catch(function () {});
    if (copyBtn) {
      var lbl = copyBtn.querySelector(".chat-btn-label");
      if (lbl) { var o = lbl.textContent; lbl.textContent = "Copied!"; setTimeout(function () { lbl.textContent = o; }, 1400); }
    }
    showToast();
  }
  if (copyBtn) copyBtn.addEventListener("click", copyEmail);
  document.addEventListener("keydown", function (e) {
    if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var tag = (e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      copyEmail();
    }
  });
})();
