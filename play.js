// Playful layer: pixel effects, sound, shake-the-tree, poke-the-cloud, the
// sun hint and the profile photo's outfit swap. Loaded after the page by script.js (see the loader there);
// styles live in styles/play.css.

/* ----------------------------------------------------------------
   Pixel effects shared by the trees and clouds: tiny sprites drawn
   from text grids (same pixel style as the nest and butterfly), and
   spawn-and-forget falling pieces positioned in document coordinates
   that remove themselves when their fall ends.
---------------------------------------------------------------- */
window.folioFx = (function () {
  "use strict";
  // Text grid -> svg -> CSS background value. Built once per sprite; the
  // browser decodes each distinct image once and reuses it for every piece.
  function sprite(rows, pal) {
    var w = rows[0].length, h = rows.length, out = "";
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var c = pal[rows[y][x]];
        if (c) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
      }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
      '" shape-rendering="crispEdges">' + out + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  // One bare span per piece, sprite as its background.
  function piece(kind, x, y, w, h, img, behind) {
    var el = document.createElement("span");
    el.className = "fall fall-" + kind + (behind ? " is-behind" : "");
    el.style.cssText =
      "left:" + x.toFixed(1) + "px;top:" + y.toFixed(1) + "px;width:" +
      w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;background-image:" + img;
    document.body.appendChild(el);
    return el;
  }

  // A piece driven by its CSS keyframes (rain, apple, bolt); the variables
  // feed them. Removed when its main animation ends (an apple also runs a
  // squash, which ends earlier).
  var DONE = { apple: "appleFall", rain: "rainFall", bolt: "boltFlash" };
  function spawn(kind, x, y, w, h, vars, img, behind) {
    var el = piece(kind, x, y, w, h, img, behind);
    for (var k in vars) el.style.setProperty("--" + k, vars[k]);
    el.addEventListener("animationend", function (e) {
      if (e.animationName === DONE[kind]) el.remove();
    });
  }

  // A piece driven by ONE Web Animation over precomputed keyframes (leaves,
  // snow). Every animation that starts or ends costs the main thread a
  // frame, and this page restyles every running animation each frame, so
  // fall + sway + tumble are sampled into a single transform track instead
  // of three animations. Still transform/opacity only: it composites.
  function fly(kind, x, y, w, h, frames, ms, img, behind) {
    var el = piece(kind, x, y, w, h, img, behind);
    el.animate(frames, { duration: ms, fill: "both" }).onfinish = function () {
      el.remove();
    };
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Round a cycle count to whole half-cycles (at least one).
  function halves(n) { return Math.max(0.5, Math.round(n * 2) / 2); }

  // The trees and clouds ship as decorative (aria-hidden) divs; they only
  // become buttons here, once this layer has loaded and can answer them.
  function asButton(el, label, press) {
    el.removeAttribute("aria-hidden");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label);
    el.addEventListener("click", press);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        press();
      }
    });
  }

  return { sprite: sprite, spawn: spawn, fly: fly, rnd: rnd, halves: halves, asButton: asButton };
})();

/* ----------------------------------------------------------------
   Sound: synthesized effects (Web Audio, nothing to download) for the
   playful clicks only - tree, clouds, the day/night switch. Never on
   hover or scroll. The AudioContext is created on the first click that
   needs one (browsers require a gesture anyway). Sound is on for every
   new visit; the footer switch mutes it for the rest of that visit.
   Everything runs through a soft compressor, so a thunderclap over a
   shower can't clip.
---------------------------------------------------------------- */
window.folioSound = (function () {
  "use strict";
  var KEY = "folio-sound";
  var on = true;
  try {
    localStorage.removeItem(KEY); // earlier builds remembered "off" forever
    on = sessionStorage.getItem(KEY) !== "off";
  } catch (e) {}
  var ctx = null, out = null, verb = null, NOISE = {};
  var rnd = window.folioFx.rnd;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.25;
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(comp);
      comp.connect(ctx.destination);
      // A small outdoor-ish space: decaying stereo noise as the impulse.
      var len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      verb = ctx.createConvolver();
      verb.buffer = ir;
      var wet = ctx.createGain();
      wet.gain.value = 0.35;
      verb.connect(wet);
      wet.connect(out);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // White, pink (Paul Kellet's filter) and brown (integrated) noise, 3s
  // each, made on first use and looped from random offsets so repeats
  // never line up.
  function noiseBuf(kind) {
    if (NOISE[kind]) return NOISE[kind];
    var n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === "white") {
        d[i] = w;
      } else if (kind === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return (NOISE[kind] = buf);
  }

  // source -> filters -> gain (envelope or curve) -> pan -> out (+ reverb)
  // o: filters [[type, freq, Q]], peak/a/r (attack, release) or curve+len,
  //    pan (-1..1), send (reverb amount).
  function voice(src, t, o) {
    var node = src;
    (o.filters || []).forEach(function (f) {
      var b = ctx.createBiquadFilter();
      b.type = f[0];
      b.frequency.value = f[1];
      b.Q.value = f[2] || 0.7;
      node.connect(b);
      node = b;
    });
    var g = ctx.createGain();
    if (o.curve) {
      g.gain.setValueAtTime(0, t);
      g.gain.setValueCurveAtTime(o.curve, t, o.len);
    } else {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.peak, t + o.a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.a + o.r);
    }
    node.connect(g);
    node = g;
    if (o.pan && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node.connect(p);
      node = p;
    }
    node.connect(out);
    if (o.send) {
      var s = ctx.createGain();
      s.gain.value = o.send;
      node.connect(s);
      s.connect(verb);
    }
  }
  function noise(kind, t, o) {
    var len = o.curve ? o.len : o.a + o.r;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf(kind);
    src.loop = true;
    voice(src, t, o);
    src.start(t, Math.random() * 2.5);
    src.stop(t + len + 0.05);
  }
  function tone(type, t, f0, f1, o) {
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + o.a + o.r);
    voice(osc, t, o);
    osc.start(t);
    osc.stop(t + o.a + o.r + 0.05);
  }
  // A gain curve that swells in, holds, fades out; `wobble` adds a slow,
  // smooth random wander (gusts, rolling thunder) instead of a flat hold.
  function swell(len, rise, fall, peak, wobble) {
    var n = 200, c = new Float32Array(n), knots = [], k;
    for (k = 0; k < 9; k++) knots.push(Math.random());
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1);
      var e = x < rise ? x / rise : x > 1 - fall ? (1 - x) / fall : 1;
      var p = x * 8, j = Math.floor(p), f = p - j, s = (1 - Math.cos(f * Math.PI)) / 2;
      var wander = knots[j] * (1 - s) + knots[Math.min(j + 1, 8)] * s;
      c[i] = peak * Math.max(0, e) * (1 - wobble + wobble * wander);
    }
    return c;
  }
  function click(t) {
    // A rocker switch: a light "tick" as it tips, then the "clack" of it
    // seating, with a little body thump.
    noise("white", t, { filters: [["bandpass", 3800, 1.8]], peak: 0.45, a: 0.0005, r: 0.012 });
    noise("white", t + 0.022, { filters: [["bandpass", 1900, 1.4]], peak: 0.55, a: 0.0008, r: 0.025 });
    tone("sine", t + 0.022, 160, 120, { peak: 0.22, a: 0.001, r: 0.045 });
  }

  var SOUNDS = {
    // Leaves rubbing: three swells that follow the canopy's rebounds.
    rustle: function (t) {
      for (var i = 0; i < 3; i++)
        noise("pink", t + i * 0.2, { filters: [["bandpass", rnd(2200, 3400), 0.8]], peak: 0.9 * Math.pow(0.55, i), a: 0.06, r: 0.3, send: 0.1 });
    },
    // An apple landing in grass; k scales the later, softer bounces.
    thud: function (t, k) {
      k = k || 1;
      tone("sine", t, 170, 60, { peak: 0.6 * k, a: 0.004, r: 0.17 });
      noise("white", t, { filters: [["lowpass", 900, 0.7]], peak: 0.16 * k, a: 0.002, r: 0.05 });
    },
    // A passing shower: a soft wash, a fine hiss, then the drops themselves -
    // dozens of tiny filtered ticks, each pitched, panned and timed apart,
    // densest in the middle - and the odd "plink" of a drop in a puddle.
    rain: function (t) {
      var len = 2.6;
      noise("pink", t, { filters: [["highpass", 500], ["lowpass", 6500]], curve: swell(len, 0.18, 0.4, 0.5, 0.25), len: len, send: 0.25 });
      noise("white", t, { filters: [["bandpass", 7000, 0.6]], curve: swell(len, 0.2, 0.4, 0.08, 0.3), len: len });
      for (var i = 0; i < 90; i++) {
        var at = t + 0.08 + len * 0.8 * (Math.random() + Math.random()) / 2;
        noise("white", at, { filters: [["bandpass", rnd(1800, 5500), rnd(3, 9)]], peak: rnd(0.07, 0.3), a: 0.001, r: rnd(0.015, 0.045), pan: rnd(-0.7, 0.7), send: 0.2 });
      }
      for (i = 0; i < 6; i++) {
        var f = rnd(900, 1700);
        tone("sine", t + rnd(0.2, len * 0.8), f, f * 1.5, { peak: 0.1, a: 0.002, r: 0.05, pan: rnd(-0.5, 0.5), send: 0.3 });
      }
    },
    // Snow is near-silent: a soft breath of wind and a few faint glints.
    snow: function (t) {
      var len = 2.8;
      noise("pink", t, { filters: [["bandpass", 700, 0.5]], curve: swell(len, 0.35, 0.45, 0.3, 0.35), len: len, send: 0.4 });
      for (var i = 0; i < 4; i++) {
        var f = rnd(2600, 4200);
        tone("triangle", t + 0.3 + i * 0.45 + rnd(0, 0.15), f, f, { peak: 0.045, a: 0.01, r: 0.9, pan: rnd(-0.6, 0.6), send: 0.6 });
      }
    },
    // A close strike: the crack and its crackle, then a long low rumble
    // that rolls (its loudness wanders), a sub-boom underneath, and a
    // fainter second roll from further away.
    thunder: function (t) {
      noise("white", t, { filters: [["highpass", 900], ["lowpass", 7000]], peak: 0.55, a: 0.002, r: 0.28, send: 0.5 });
      for (var i = 0; i < 6; i++)
        noise("white", t + rnd(0, 0.35), { filters: [["bandpass", rnd(1500, 4000), 1.2]], peak: rnd(0.15, 0.35), a: 0.001, r: rnd(0.05, 0.1), pan: rnd(-0.6, 0.6), send: 0.4 });
      noise("brown", t + 0.03, { filters: [["lowpass", 180, 0.7]], curve: swell(4.8, 0.03, 0.75, 0.95, 0.55), len: 4.8, send: 0.45 });
      tone("sine", t + 0.02, 55, 32, { peak: 0.35, a: 0.02, r: 1.6 });
      noise("brown", t + 1.2, { filters: [["lowpass", 120, 0.7]], curve: swell(3, 0.25, 0.6, 0.5, 0.5), len: 3, pan: rnd(-0.4, 0.4), send: 0.5 });
    },
    // Lights out: the switch, then crickets start up outside.
    night: function (t) {
      click(t);
      for (var c = 0; c < 2; c++) {
        var f = 4300 + c * 350, start = t + 0.35 + c * 0.18;
        for (var k = 0; k < 3; k++)
          for (var p = 0; p < 4; p++)
            tone("sine", start + k * 0.42 + p * 0.028, f, f, { peak: 0.09, a: 0.002, r: 0.018, pan: c ? 0.4 : -0.4, send: 0.5 });
      }
    },
    // Morning: the switch, then a bird.
    day: function (t) {
      click(t);
      for (var k = 0; k < 3; k++)
        tone("sine", t + 0.3 + k * 0.13, 2600, 4300, { peak: 0.12, a: 0.005, r: 0.07, pan: 0.3, send: 0.45 });
      tone("sine", t + 0.78, 3800, 3000, { peak: 0.1, a: 0.004, r: 0.06, pan: 0.3, send: 0.45 });
      tone("sine", t + 0.86, 3800, 3000, { peak: 0.09, a: 0.004, r: 0.06, pan: 0.3, send: 0.45 });
    },
    blip: function (t) { tone("sine", t, 1200, 1200, { peak: 0.1, a: 0.005, r: 0.08 }); },
  };

  function play(name, delay, arg) {
    if (!on || !SOUNDS[name]) return;
    if (!ensure()) return;
    try { SOUNDS[name](ctx.currentTime + 0.01 + (delay || 0), arg); } catch (e) {}
  }

  // Footer switches, one in each mode's footer, kept in sync. Built here
  // rather than shipped in the HTML: without JS there is no sound, so
  // there is no switch either, and the page's HTML stays as it was.
  var toggles = [
    document.querySelector(".site-footer > div"),
    document.querySelector(".creative-footer"),
  ].filter(Boolean).map(function (spot) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "sound-toggle";
    b.innerHTML =
      '<span class="st-bars" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="st-label"></span>';
    spot.appendChild(b);
    return b;
  });
  function render() {
    toggles.forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.querySelector(".st-label").textContent = on ? "Sound on" : "Sound off";
    });
  }
  toggles.forEach(function (b) {
    b.addEventListener("click", function () {
      on = !on;
      try { sessionStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
      render();
      if (on) play("blip");
    });
  });
  render();

  return { play: play };
})();

/* ----------------------------------------------------------------
   Shake the trees: a click (or Enter/Space) bends the canopy and lets
   it spring back; leaves come loose from the rim during the rebounds
   and tumble down, and every fourth shake an apple drops out from
   behind the foliage. Nothing is created at click time: each piece is
   spawned at the moment it detaches. The motion is CSS keyframes on
   transform/opacity, so JS only spawns nodes and removes them when the
   fall ends. Reduced motion: the tree only rustles (sound). Narrow
   screens hide the trees (display:none), so nothing runs there.
---------------------------------------------------------------- */
(function () {
  "use strict";
  var trees = document.querySelectorAll(".tree");
  if (!trees.length) return;
  // Reduced motion: the tree stays still and only rustles (sound), so the
  // button still answers.
  var still =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The tree sprite is 54x86 art pixels. The canopy is a disc centred at
  // (27,27) with radius ~23; the grass line (top of the base) is row 76.
  var ART_W = 54, CX = 27, CY = 27, CR = 23, GROUND = 78;

  var fx = window.folioFx, sprite = fx.sprite, spawn = fx.spawn, rnd = fx.rnd, halves = fx.halves;

  // Leaf colours are the tree's own four greens, plus the odd turned leaf.
  var LEAF_ROWS = ["...LH", ".LLLL", "LLHL.", "sL..."];
  var LEAVES = [
    ["#70aa58", "#92c674"],
    ["#4e8c40", "#70aa58"],
    ["#366830", "#4e8c40"],
    ["#70aa58", "#92c674"],
    ["#4e8c40", "#92c674"],
    ["#c9932f", "#e6b450"],
  ].map(function (c) {
    return sprite(LEAF_ROWS, { L: c[0], H: c[1], s: "#60462c" });
  });
  var APPLE_ROWS = ["..s...", "..s.L.", ".RRRR.", "RhRRRR", "RRRRRR", "RRRRRR", ".RRRR."];
  var APPLE = sprite(APPLE_ROWS, { s: "#6b4423", L: "#4f9a3a", R: "#e23b3b", h: "#ff8a8a" });

  // A falling leaf, sampled at ~30 keyframes a second (the compositor
  // interpolates between them), all as one transform track:
  //  - fall: from rest under air drag, so it quickly settles at a slow
  //    terminal speed, landing at LAND (80%) of the duration;
  //  - drift: the outward push from the swinging canopy, early, then coast;
  //  - sway: a pendulum about the pivot set in play.css (fastest through the
  //    middle), starting a moment after release;
  //  - tumble: horizontal scale on a cosine (lingers face-on, snaps through
  //    edge-on, shows the underside);
  //  - then it rests on the grass and fades over the last 8%.
  var LAND = 0.8, SWAY_LAG = 0.15, DRAG = 7;
  function leafPath(o) {
    var n = Math.round(o.dur * 30), frames = [];
    var dragNorm = 1 - (1 - Math.exp(-DRAG)) / DRAG;
    var swayDur = o.dur * LAND - SWAY_LAG;
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = Math.min(t / LAND, 1);
      var yy = (o.fall * (u - (1 - Math.exp(-DRAG * u)) / DRAG)) / dragNorm;
      var xx = (o.dx * (1 - Math.exp(-5 * u))) / (1 - Math.exp(-5));
      var ts = Math.min(Math.max((t * o.dur - SWAY_LAG) / swayDur, 0), 1);
      var rot = o.tilt * Math.sin(2 * Math.PI * o.swayN * ts) * Math.min(1, ts * 4);
      var sx = Math.cos(2 * Math.PI * o.flipN * u);
      frames.push({
        transform: "translate(" + xx.toFixed(2) + "px," + yy.toFixed(2) + "px) rotate(" +
          rot.toFixed(2) + "deg) scale(" + sx.toFixed(3) + ",1)",
        opacity: t < 0.92 ? 1 : +(1 - (t - 0.92) / 0.08).toFixed(3),
      });
    }
    return frames;
  }

  var shakes = 0;
  function shake(tree) {
    window.folioSound.play("rustle");
    if (still) return;
    tree.classList.remove("is-shaking");
    void tree.offsetWidth; // restart the rustle on rapid clicks
    tree.classList.add("is-shaking");

    // Measure now (before the skew moves the crown). Document coordinates:
    // the trees and the falling pieces both sit on the initial containing
    // block.
    var r = tree.getBoundingClientRect();
    var s = r.width / ART_W; // screen px per art pixel
    var left = r.left + window.scrollX, top = r.top + window.scrollY;
    var cx = left + CX * s, cy = top + CY * s, cr = CR * s;
    var ground = top + GROUND * s;

    var n = 5 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      // Most leaves let go on the first two rebounds, a few stragglers later.
      setTimeout(dropLeaf, 150 + 700 * Math.pow(Math.random(), 1.6));
    }
    function dropLeaf() {
      // A point on the canopy rim: the sides and underside, where a
      // shaken leaf actually comes free (angle 0 = right, 90 = bottom).
      var a = rnd(-25, 205) * Math.PI / 180;
      var rr = cr * rnd(0.72, 0.98);
      var w = 5 * s, h = 4 * s;
      var x = cx + Math.cos(a) * rr - w / 2;
      var y = cy + Math.sin(a) * rr - h / 2;
      var dur = rnd(2.4, 3.8);
      fx.fly("leaf", x, y, w, h, leafPath({
        dur: dur,
        fall: ground - y - h + rnd(-1, 2),
        dx: (x + w / 2 < cx ? -1 : 1) * rnd(6, 26), // pushed outward by the swing
        tilt: rnd(16, 34), // degrees; ~4-9px of swing on the pivot
        // Whole half-cycles, so it touches down hanging straight and face-on.
        swayN: halves((dur * LAND - SWAY_LAG) / rnd(1.4, 2.2)),
        flipN: halves((dur * LAND) / rnd(0.55, 1.2)),
      }), dur * 1000, LEAVES[Math.floor(Math.random() * LEAVES.length)], Math.random() < 0.35);
    }

    shakes++;
    if (shakes % 4 === 0) {
      setTimeout(function () {
        var w = 6 * s, h = 7 * s;
        var x = cx + rnd(-0.4, 0.4) * cr - w / 2;
        var y = cy + cr * 0.35 - h / 2; // hidden in the lower foliage
        var dir = Math.random() < 0.5 ? -1 : 1;
        spawn("apple", x, y, w, h, {
          fall: (ground - y - h).toFixed(1) + "px",
          roll: (dir * rnd(10, 18)).toFixed(1) + "px",
          spin: (dir * rnd(60, 90)).toFixed(0) + "deg",
        }, APPLE, true);
        // Landing and the two bounces, timed to appleFall (5.2s: 13%, 25%, 32%).
        window.folioSound.play("thud", 0.68, 1);
        window.folioSound.play("thud", 1.3, 0.4);
        window.folioSound.play("thud", 1.66, 0.15);
      }, rnd(260, 420));
    }
  }

  Array.prototype.forEach.call(trees, function (tree) {
    var big = tree.classList.contains("tree-1");
    fx.asButton(tree, big ? "Shake the big tree" : "Shake the small tree", function () { shake(tree); });
  });
})();

/* ----------------------------------------------------------------
   Poke a cloud. The big one is a storm cloud: every poke squishes it,
   throws a bolt of lightning and a shower, and the thunder follows the
   flash. The small one drizzles (snows at night), and three quick pokes
   make it thunder too. Same spawn-and-forget pattern as the trees.
   Reduced motion: sound only.

   The clouds are restyled every frame while the page scrolls (the
   parallax in script.js rewrites their transform), so they stay bare:
   the clickable silhouette, the focus state and the rain/flash tint all
   live on a child, .cloud-hit, which those per-frame restyles never
   touch.
---------------------------------------------------------------- */
(function () {
  "use strict";
  var clouds = document.querySelectorAll(".cloud");
  if (!clouds.length) return;
  var still =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fx = window.folioFx, sprite = fx.sprite, spawn = fx.spawn, rnd = fx.rnd;

  // Colours from the cloud sprite itself (#6fb3df outline, #b4d8f1 shade).
  var DROP = sprite(["R", "R", "r"], { R: "#b4d8f1", r: "#6fb3df" });
  var FLAKE = sprite([".W.", "WWW", ".W."], { W: "#f4f8fd" });
  var BOLT = sprite(
    ["...YY.", "..YYW.", "..YW..", ".YYWYY", "...YY.", "..YW..", "..Y...", ".YW...", ".Y....", "Y....."],
    { Y: "#ffd84a", W: "#fff6c8" },
  );

  // A snowflake: steady fall, gentle pendulum drift, fades in and out. One
  // sampled track, like the leaves.
  function snowPath(o) {
    var n = Math.round(o.dur * 30), frames = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var rot = o.tilt * Math.sin(2 * Math.PI * o.swayN * t);
      frames.push({
        transform: "translate(" + (o.dx * t).toFixed(2) + "px," + (o.fall * t).toFixed(2) +
          "px) rotate(" + rot.toFixed(2) + "deg)",
        opacity: t < 0.08 ? +(t / 0.08).toFixed(3) : t > 0.78 ? +((1 - t) / 0.22).toFixed(3) : 1,
      });
    }
    return frames;
  }

  var smallPokes = [];
  var lastThunder = 0;
  function poke(cloud, hit, big) {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var now = Date.now(), storm = big;
    if (!big) {
      smallPokes = smallPokes.filter(function (t) { return now - t < 1600; });
      smallPokes.push(now);
      if (smallPokes.length >= 3) { storm = true; smallPokes = []; }
    }

    window.folioSound.play(dark ? "snow" : "rain");
    // Light first, sound a beat later. Rapid pokes share one rumble
    // instead of stacking thunderclaps on top of each other.
    if (storm && now - lastThunder > 700) {
      lastThunder = now;
      window.folioSound.play("thunder", 0.25);
    }
    if (still) return;

    cloud.classList.remove("is-poked");
    void cloud.offsetWidth;
    cloud.classList.add("is-poked");
    hit.classList.add("is-raining");
    clearTimeout(hit._rainT);
    hit._rainT = setTimeout(function () { hit.classList.remove("is-raining"); }, 1700);

    // Measured with the parallax offset included, so drops start right
    // under where the cloud is drawn now.
    var r = cloud.getBoundingClientRect();
    var s = r.width / 54; // screen px per art pixel
    var left = r.left + window.scrollX;
    var base = r.top + window.scrollY + r.height * 0.88;
    var i;
    if (!dark) {
      for (i = 0; i < (big ? 22 : 16); i++)
        setTimeout(function () {
          spawn("rain", left + r.width * rnd(0.16, 0.84), base - 2 * s, s, 3 * s, {
            fall: rnd(60, 115).toFixed(0) + "px",
            dur: rnd(0.45, 0.72).toFixed(2) + "s",
          }, DROP, true);
        }, rnd(0, 900));
    } else {
      for (i = 0; i < 10; i++)
        setTimeout(function () {
          var dur = rnd(1.8, 2.7);
          fx.fly("snow", left + r.width * rnd(0.16, 0.84), base - 2 * s, 2.2 * s, 2.2 * s, snowPath({
            dur: dur,
            fall: rnd(70, 125),
            dx: rnd(-12, 12),
            tilt: rnd(12, 24), // degrees; ~3-6px of drift on the pivot
            swayN: fx.halves(dur / rnd(1.2, 1.9)),
          }), dur * 1000, FLAKE, true);
        }, rnd(0, 1100));
    }

    if (storm) {
      var bw = 6 * s * 1.9, bh = 10 * s * 1.9;
      spawn("bolt", left + r.width * rnd(0.35, 0.6) - bw / 2, base - 3 * s, bw, bh, {}, BOLT, false);
      // Two flashes of the cloud itself, in step with the bolt.
      [0, 140].forEach(function (d) {
        setTimeout(function () { hit.classList.add("is-flash"); }, d);
        setTimeout(function () { hit.classList.remove("is-flash"); }, d + 70);
      });
    }
  }

  Array.prototype.forEach.call(clouds, function (cloud) {
    var big = cloud.classList.contains("cloud-1");
    var hit = document.createElement("span");
    hit.className = "cloud-hit";
    cloud.appendChild(hit);
    // The cloud was decorative (aria-hidden); its child is now a button.
    cloud.removeAttribute("aria-hidden");
    fx.asButton(hit, big ? "Poke the storm cloud" : "Poke the small cloud", function () { poke(cloud, hit, big); });
  });
})();

/* ----------------------------------------------------------------
   Theme switch, made findable. The sun/moon half-hides behind the big
   cloud, so new visitors get one unprompted reveal a few seconds in
   (after the intro teaser has finished): it steps in front of the
   cloud, wiggles and says "Call it a night". Shown on at most three visits
   and never again once the visitor has used it. Also plays the day /
   night chime on every switch.
---------------------------------------------------------------- */
(function () {
  "use strict";
  var btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  var KEY = "folio-theme-hint";
  var state = { shown: 0, used: false };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.shown === "number")
      state = { shown: saved.shown, used: saved.used === true };
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  btn.addEventListener("click", function () {
    btn.classList.remove("is-hinting");
    if (!state.used) { state.used = true; save(); }
    // The theme handler (top of this file) has already flipped data-theme.
    setTimeout(function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      window.folioSound.play(dark ? "night" : "day");
    }, 0);
  });

  if (state.used || state.shown >= 3) return;
  function show() {
    // Only if the sun is actually on screen; otherwise save it for later.
    if (state.used || window.scrollY > 300) return;
    state.shown++;
    save();
    btn.classList.add("is-hinting");
    setTimeout(function () { btn.classList.remove("is-hinting"); }, 3400);
  }
  function start() {
    if (document.hidden) {
      document.addEventListener("visibilitychange", function onVis() {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVis);
          setTimeout(show, 2500);
        }
      });
      return;
    }
    show();
  }
  function schedule() { setTimeout(start, 6500); }
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
})();

/* ----------------------------------------------------------------
   Outfit swap on the profile photo. Hover and the picture breaks into
   pixels in a wave that runs down it: each row first turns into solid
   colour blocks (each block the average colour of that patch, popping a
   little bigger than its slot), then sharpens into the second photo.
   Leaving runs the same wave back, from wherever it got to, so quick
   in-and-out never jumps. Tap toggles on touch screens.

   Drawn on a small canvas, only while something is moving (no idle
   work, no DOM cells, no seams). The second photo (6.5 KB, same framing
   as 01.webp) is fetched when the browser is idle after load, so none
   of this touches the page load or the avatar as LCP. Reduced motion:
   an instant swap.
---------------------------------------------------------------- */
(function () {
  "use strict";
  var avatar = document.querySelector(".profile-avatar");
  if (!avatar || !window.HTMLCanvasElement) return;
  var OLD = "./images/01.webp", NEW = "./images/01-figma.webp";
  var IMG_W = 256, IMG_H = 320; // both photos
  var N = 16; // pixels per side
  // A short change per cell against the row delay keeps the blocky band
  // thin: only ~2-3 rows are solid pixels at any moment as it sweeps down.
  var ROW_DELAY = 40, JITTER = 30, DUR = 280; // ms
  var BLOCK = 0.35; // share of a cell's change spent as a solid block
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ROW_DELAY = JITTER = 0;
    DUR = 1;
  }

  var idle = window.requestIdleCallback || function (f) { setTimeout(f, 300); };
  idle(function () { new Image().src = NEW; });

  var ready = null, canvas, g, W, H, dpr, bh, oy, xs, ys;
  var avgOld = [], avgNew = [], cells = [], target = 0, raf = 0;

  function load(src) {
    var i = new Image();
    i.src = src;
    return i.decode().then(function () { return i; });
  }
  function init() {
    if (!ready)
      ready = Promise.all([load(OLD), load(NEW)]).then(function (im) {
        canvas = document.createElement("canvas");
        canvas.className = "avatar-swap";
        canvas.setAttribute("aria-hidden", "true");
        avatar.appendChild(canvas);
        g = canvas.getContext("2d");
        for (var i = 0; i < N * N; i++) cells.push({ v: 0, from: 0, start: 0 });
        return { old: im[0], neu: im[1] };
      });
    return ready;
  }

  // The avatar draws its photo as a 4:5 cover background shifted 5% down
  // (app.css). Reproduce that geometry so the canvas lines up exactly.
  function measure(im) {
    if (W === avatar.clientWidth && H === avatar.clientHeight) return;
    W = avatar.clientWidth;
    H = avatar.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    bh = (W * IMG_H) / IMG_W;
    oy = 0.05 * (H - bh);
    xs = []; ys = [];
    for (var i = 0; i <= N; i++) {
      xs.push(Math.round((i * canvas.width) / N)); // whole device pixels
      ys.push(Math.round((i * canvas.height) / N));
    }
    avgOld = averages(im.old);
    avgNew = averages(im.neu);
  }
  // Source rect (in photo pixels) behind a canvas rect (device pixels).
  function src(x, y, w, h) {
    return [((x / dpr) * IMG_W) / W, ((y / dpr - oy) * IMG_H) / bh, ((w / dpr) * IMG_W) / W, ((h / dpr) * IMG_H) / bh];
  }
  // Each cell's average colour: the visible part of the photo scaled down
  // to N x N.
  function averages(img) {
    var off = document.createElement("canvas");
    off.width = off.height = N;
    var o = off.getContext("2d");
    var s = src(0, 0, canvas.width, canvas.height);
    o.drawImage(img, s[0], s[1], s[2], s[3], 0, 0, N, N);
    var d = o.getImageData(0, 0, N, N).data, out = [];
    for (var i = 0; i < N * N; i++) out.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    return out;
  }

  function go(to) {
    target = to;
    init().then(function (im) {
      measure(im);
      var now = performance.now();
      cells.forEach(function (c, i) {
        c.from = c.v;
        c.start = now + Math.floor(i / N) * ROW_DELAY + Math.random() * JITTER;
      });
      if (!raf) raf = requestAnimationFrame(function (t) { frame(t, im); });
    });
  }

  function frame(now, im) {
    var busy = false;
    var s = src(0, 0, canvas.width, canvas.height);
    g.globalAlpha = 1;
    g.drawImage(im.old, s[0], s[1], s[2], s[3], 0, 0, canvas.width, canvas.height);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], t = (now - c.start) / DUR;
      c.v = t <= 0 ? c.from : c.from + (target - c.from) * Math.min(t, 1);
      if (c.v !== target) busy = true;
      if (c.v <= 0) continue;
      var r = Math.floor(i / N), col = i % N;
      var x = xs[col], y = ys[r], w = xs[col + 1] - x, h = ys[r + 1] - y;
      if (c.v >= 1) {
        var q = src(x, y, w, h);
        g.drawImage(im.neu, q[0], q[1], q[2], q[3], x, y, w, h);
        continue;
      }
      var a = avgOld[i], b = avgNew[i];
      if (c.v < BLOCK) {
        // A solid pixel appearing and taking on the new colour, popping a
        // little bigger than its slot on the way.
        var k = c.v / BLOCK, grow = 1 + 0.28 * Math.sin(Math.PI * k);
        var bw = w * grow, bhh = h * grow;
        g.globalAlpha = Math.min(1, k * 6);
        g.fillStyle = "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
        g.fillRect(x + (w - bw) / 2, y + (h - bhh) / 2, bw, bhh);
        g.globalAlpha = 1;
      } else {
        // The block resolving into the new photo.
        g.fillStyle = "rgb(" + b[0] + "," + b[1] + "," + b[2] + ")";
        g.fillRect(x, y, w, h);
        var p = src(x, y, w, h);
        g.globalAlpha = (c.v - BLOCK) / (1 - BLOCK);
        g.drawImage(im.neu, p[0], p[1], p[2], p[3], x, y, w, h);
        g.globalAlpha = 1;
      }
    }
    raf = busy ? requestAnimationFrame(function (t) { frame(t, im); }) : 0;
  }

  avatar.addEventListener("pointerenter", function (e) {
    if (e.pointerType !== "touch") go(1);
  });
  avatar.addEventListener("pointerleave", function (e) {
    if (e.pointerType !== "touch") go(0);
  });
  avatar.addEventListener("click", function () {
    if (!window.matchMedia("(hover: hover)").matches) go(target ? 0 : 1);
  });
})();
