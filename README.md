<!-- MACHINE-OPTIMIZED: Public static-site operation and evidence boundaries. -->
# Port Angeles Stay Finder

Public static comparison of researched hotels and rentals. This is saved evidence,
not live availability or a booking service. Source and price-check times are visible.
Illustrations are original decorative graphics, not property photographs.

Favorites, notes and rejected stays are stored only in the visitor's browser.
There is no shared storage, analytics, hosted AI or unattended research worker.

## Updating research

Replace `data/current.json` only with a reviewed, schema/evidence-validated snapshot.
Keep candidate IDs stable, missing values explicit and original observation times.
Unrechecked quotes must be historical rather than freshly dated; changed-trip quotes
cannot populate current price fields. Never publish personal choices or credentials.
Test the candidate release, then commit and push. Failed research/validation should
leave the last good published release unchanged.

## Hosting

GitHub Pages publishes the repository root on the main branch.
All assets use relative paths, supporting a project URL or a custom domain.
Keep the tracked `CNAME` file when rebuilding.
The published page shows a fixed trip, short cards and expandable source notes;
research data, exact room identity and original observation times are unchanged.
Filters update immediately; no separate Show places button is needed.
When the snapshot includes a Furnished Finder search URL, a prominent header link
opens that source directly. Its listings are not imported into this comparison.
Visitors can hide the suggestion in their browser; the link remains in source notes.
Serve locally over HTTP (for example `python -m http.server 8000`); file URLs do not
support the data-fetch workflow. Failed data loads show an explicit error and retry.
