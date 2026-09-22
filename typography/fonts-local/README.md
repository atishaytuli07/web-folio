# Local-only font files

Licensed faces cannot be hosted on the public site, so `/typography` shows a
screenshot of the real site for those rows instead.

If you own a licence and want a **live** specimen while working locally, drop
the `.woff2` here and open the page with `?local=1`:

    http://localhost:8000/typography?local=1

That row then swaps its screenshot for live type. Without `?local=1` nothing is
requested, so there are no 404s in the console.

Filenames the page looks for:

    pp-neue-montreal.woff2
    pp-editorial-new.woff2
    freight-big-pro.woff2
    teodor.woff2
    sofia-pro.woff2
    degular.woff2
    champ.woff2
    sometype-mono.woff2

This folder is gitignored (except this README). Nothing here ever deploys.
