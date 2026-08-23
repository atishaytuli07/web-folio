# web-folio

My portfolio. Live at [creativeatishay.in](https://www.creativeatishay.in).

One HTML file, hand-written CSS, vanilla JavaScript. No framework, no build step, no dependencies except [Lenis](https://lenis.darkroom.engineering/) for smooth scrolling. Everything else on the page, including the animations, the folder system, and the pixel art, is written by hand.

## Two modes

The site has a toggle at the top:

- **Minimal** is the pitch: who I am, where I work, my best projects with real numbers, and how to reach me.
- **Creative** is the archive: every project I have ever shipped, organized into folders you can open in place. Products, full-stack builds, 17 client works, Figma case studies, site recreations, open source, and the receipts (screenshots of every feature and trending moment).

Same document, two audiences. The mode you pick is remembered.

## How it is built

- **Vanilla everything.** `index.html` + three stylesheets + one `script.js` (about 1,300 lines). Each interactive piece is a small self-contained IIFE: the mode toggle, the folder system, the show-more collapses, the GitHub contribution graph, the tortoise-and-hare race on a canvas, the sparrow that sits while you scroll and takes off when you pause.
- **Pixel art as inline SVG.** The birds, the panda eating the contribution graph, the dog, the frog, the butterfly, and the nest are drawn rect-by-rect as inline SVG, so they ship with the document and scale crisply with `image-rendering: pixelated`.
- **Self-hosted fonts.** Latin subsets of Bricolage Grotesque (display), Hanken Grotesk (body), and JetBrains Mono (metrics), served same-origin with preloads for the two faces the first paint needs.

## Performance

The site is built to hold a perfect Lighthouse score, and the tricks are commented in the source:

- The LCP image is preloaded with `fetchpriority="high"` because it is a CSS background the browser cannot discover early on its own.
- Below-the-fold sections use `content-visibility: auto` so first paint skips their layout entirely.
- All archive images are lazy: only 6 of ~90 images load before you scroll or open a folder.
- Animations are compositor-friendly on purpose: sprite frames advance by transform instead of background-position, the role cascade is opacity-only, and the flying bird is a CSS animation instead of a rAF loop. The reasons are in the comments where each decision lives.
- The whole document gzips to about 26 KB.

## Accessibility

Skip link, `sr-only` text behind every decorative animation, `aria-hidden` on the pixel art, keyboard-focusable scrollers, visible focus styles, and a `prefers-reduced-motion` pass that stills every animation and shows static equivalents.

## Run it

No build step. Clone and serve the folder with anything static:

```bash
git clone https://github.com/atishaytuli07/web-folio.git
cd web-folio
npx serve .        # or python -m http.server, or VS Code Live Server
```

Opening `index.html` directly also works for a quick look, though a server is closer to production behavior.

## Structure

```
index.html          the whole site, both modes
styles/style.css    base tokens and layout
styles/app.css      components, modes, animations (the bulk)
styles/fonts.css    @font-face declarations
script.js           all interactivity, small IIFEs
scripts/lenis.min.js
fonts/  images/  videos/
llms.txt            machine-readable summary for AI crawlers
```

---

Design and code by [Atishay Tuli](https://www.creativeatishay.in). If something in here is useful to you, take it.
