---
name: pdf-to-png
description: Convert PDF files to per-page PNG images using pdftoppm command-line tool.
---

# PDF-to-PNG Skill

Convert a PDF into one PNG per page using the `pdftoppm` utility (part of the Poppler library).

## Conventions

Given an input PDF at `<dir>/<name>.pdf`:

1. Create a sibling folder `<dir>/<name>/`.
2. Write each page as `<dir>/<name>/page-<N>.png`.

So `~/Downloads/xxx/yyy/march-bill.pdf` produces:

```
~/Downloads/xxx/yyy/march-bill/page-1.png
~/Downloads/xxx/yyy/march-bill/page-2.png
...
```

---

## Prerequisites

`pdftoppm` ships with the `poppler` package — the same package as `pdftotext`.

**macOS:**
```bash
brew install poppler
```

**Linux:**
```bash
apt-get install poppler-utils
```

Verify installation:
```bash
pdftoppm -v
```

---

## Basic Usage

`pdftoppm` iterates over every page on its own — no shell loop needed.

### Convert a single PDF

```bash
pdf="path/to/march-bill.pdf"
out="${pdf%.pdf}"
mkdir -p "$out"
pdftoppm -png -r 200 "$pdf" "$out/page"
```

This writes `path/to/march-bill/page-1.png`, `page-2.png`, ….

### Batch convert every PDF in a directory

```bash
cd ~/Downloads/FSA_DCFSA_Bills/2026-02/

for pdf in *.pdf; do
  out="${pdf%.pdf}"
  mkdir -p "$out"
  pdftoppm -png -r 200 "$pdf" "$out/page"
  echo "Converted: $pdf → $out/page-*.png"
done
```

### Extract only specific pages

```bash
pdftoppm -png -r 200 -f 1 -l 3 input.pdf out/page
# → out/page-1.png, page-2.png, page-3.png
```

---

## Common Options

| Option | Description |
|--------|-------------|
| **`-png`** | **Emit PNG files (this skill always uses this).** |
| `-r <dpi>` | Resolution in DPI. Default `150`. Use `200`–`300` for sharp text or downstream OCR. |
| `-rx <dpi>` / `-ry <dpi>` | Separate X / Y resolution. |
| `-f <N>` | First page to render. |
| `-l <N>` | Last page to render. |
| `-gray` | Render grayscale (smaller files for text-only docs). |
| `-mono` | Render monochrome (1-bit). |
| `-cropbox` | Use the PDF's crop box rather than media box. |
| `-singlefile` | Suppress the `-N` page-number suffix. Use **only** for single-page extraction. |

---

## Examples

### FSA/DCFSA monthly statement

```bash
pdf="$HOME/Downloads/FSA_DCFSA_Bills/2026-02/Credit Statement February 2026.pdf"
out="${pdf%.pdf}"
mkdir -p "$out"
pdftoppm -png -r 200 "$pdf" "$out/page"

ls "$out"
# page-1.png  page-2.png  page-3.png  …
```

### Extract a single page (no numeric suffix)

```bash
pdftoppm -png -r 300 -f 5 -l 5 -singlefile report.pdf cover
# → cover.png
```

---

## Filename numbering — important

`pdftoppm` zero-pads the page number based on the **total page count**:

| Pages in PDF | Filenames |
|--------------|-----------|
| 1–9          | `page-1.png` … `page-9.png` |
| 10–99        | `page-01.png` … `page-99.png` |
| 100–999      | `page-001.png` … |

This is `pdftoppm`'s native behavior, not configurable. When iterating
output files in a downstream script, glob for `page-*.png` and sort
naturally rather than hard-coding the width:

```bash
ls "$out"/page-*.png | sort -V
```

---

## Troubleshooting

### Command not found

```
pdftoppm: command not found
```

Install poppler (see Prerequisites).

### Output looks blurry / text is fuzzy

Raise the resolution:

```bash
pdftoppm -png -r 300 input.pdf out/page
```

Default is 150 DPI; 200–300 is a good range for screen viewing or OCR.

### Files are huge

Drop DPI, or render grayscale for text-only documents:

```bash
pdftoppm -png -r 150 -gray input.pdf out/page
```

### Output directory doesn't exist

`pdftoppm` will not create the parent directory for you — always
`mkdir -p` first:

```bash
mkdir -p "$out"
pdftoppm -png -r 200 "$pdf" "$out/page"
```

---

## Return Codes

- `0` — Success
- `1` — Error opening input file
- `2` — Error opening output file
- `99` — Other error

---

## Related Skills

- **pdf-to-text** — Same Poppler package; use when you need extractable text instead of images.
- **fsa-dcfsa-claims-automation** — Consumes per-page renders for visual cross-referencing of statements.

---

## Additional Resources

- [Poppler Documentation](https://poppler.freedesktop.org/)
- [pdftoppm Manual](https://www.unix.com/man-page/linux/1/pdftoppm/)
