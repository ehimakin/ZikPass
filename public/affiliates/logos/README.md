# Fictional affiliate logos — draft 2

22 original vector identity concepts for the ZikPass prototype. These are fictional brands, not real affiliations or endorsements. No copied logos or explicit imagery.

- `contact-sheet.png`: rendered review sheet.
- `contact-sheet.svg`: visual review sheet (all 22).
- `manifest.json`: exact display names, asset URLs, colours and proposed taglines.
- `<slug>.svg`: transparent logo composition (480 × 260 viewBox).
- `<slug>-mark.svg`: separate symbol (100 × 100 viewBox).

Use the suggested pale brand background or a light neutral behind these dark marks. They are not inverted for dark backgrounds. SVGs use system font stacks; typography can vary by device. Convert type to outlines before final production branding if exact rendering is required.

UKBunniesGetHotBrownCocoa and FacialBook- The Organic Beauty Blog use their exact full names in a uniform text size, without separate taglines. All original names are retained in the manifest and SVG accessible titles. Taglines are creative proposals for review.

Assets are prepared for review and have not been inserted into application screens.

Draft 2 introduces centre/left/right-aligned stacks, emblems, reverse lockups and type-led layouts. Original draft is archived in `../zikpass-affiliate-logos-draft-1.zip`. Regenerate SVGs with `python3 scripts/generate-affiliate-logos.py` from the repository root.

## Desktop site display

The customer shell displays all 22 fictional logos in two fixed side groups,
3 / 4 / 4 per side, above the bottom navigation. Visible from 1360px viewport
width; hidden on narrower layouts. CSS applies grayscale and reduced opacity.
The original SVGs are transparent; the coloured cards exist only on the contact
sheet. `desktop/` contains trimmed SVG viewBoxes for consistent visible sizing.
After regenerating the source logos, run
`node scripts/prepare-affiliate-desktop-logos.cjs` to refresh those derivatives.


## Responsive affiliate pool (September 2026)

The live pool is every SVG, PNG, WebP or AVIF file in `public/affiliates/logos/desktop/`. Add, replace or remove display-ready transparent assets there; `/api/affiliates/logos` discovers them on the next full page load. Contact sheets and standalone marks in the parent folder are excluded. For generated assets, run the existing preparation script to create the trimmed versions, and remove obsolete trimmed files when retiring an affiliate. On hosted deployments, ship the updated public assets with the application.

The pool is shuffled once per document load and stays stable through client navigation and resizing. Desktop (1360px+) uses four columns per rail and caps selection to the rows fitting between the header clearance and the current offset above the bottom nav. A partial row goes at the top. Mobile/tablet uses half the pool, rounded up, as a scrolling footer, with 50px top margin and nav-safe bottom padding. The current 22 logos produce 11 mobile logos.

The homepage splash is restored from the previous design: 700ms on a first visit, suppressed by the existing `zikpass-home-splash-seen` cookie and `ZIK_HOMEPAGE_SPLASH_SUPPRESS_SECONDS` setting (30 minutes production / 120 seconds development by default). It skips animation for reduced-motion preferences.
