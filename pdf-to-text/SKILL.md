---
name: pdf-to-text
description: Convert PDF files to plain text using pdftotext command-line tool.
---

# PDF-to-Text Skill

Convert PDF files to plain text using the pdftotext utility (part of the Poppler library).

## Prerequisites

Install pdftotext:

**macOS:**
```bash
brew install poppler
```

**Linux:**
```bash
apt-get install poppler-utils
```

**Windows:**
Download from: https://blog.alivate.com.au/poppler-windows/

Verify installation:
```bash
pdftotext -v
```

---

## Basic Usage

**Important:** Always use `-layout` parameter to preserve the document structure (required for financial statements, tables, and multi-column layouts).

### Convert Single PDF (with layout preservation)

```bash
pdftotext -layout input.pdf output.txt
```

### Convert PDF (same filename, .txt extension, with layout)

```bash
pdftotext -layout document.pdf document.txt
# Creates: document.txt
```

### Batch Convert Multiple PDFs (with layout)

```bash
for file in *.pdf; do
  pdftotext -layout "$file" "${file%.pdf}.txt"
done
```

### Convert with Additional Options

```bash
# Layout + specify page range (first 10 pages)
pdftotext -layout -f 1 -l 10 input.pdf output.txt

# Layout + custom margins
pdftotext -layout -m 10 input.pdf output.txt

# Layout + specific encoding
pdftotext -layout -enc UTF-8 input.pdf output.txt
```

---

## Common Options

| Option | Description |
|--------|-------------|
| **`-layout`** | **Preserve original PDF layout (ALWAYS USE for financial statements, tables, multi-column layouts)** |
| `-f N` | Start from page N |
| `-l N` | End at page N |
| `-m NUM` | Margin size in pixels |
| `-enc UTF-8` | Specify output encoding |
| `-nopgbrk` | Don't add page breaks |
| `-q` | Quiet mode (suppress messages) |

---

## Examples

### FSA/DCFSA Credit Card Statement (with layout)

```bash
# Convert credit card statement with layout preservation
pdftotext -layout "Credit Statement February 2026.pdf" "Credit Statement February 2026.txt"

# View output
cat "Credit Statement February 2026.txt"
```

### Batch Convert Monthly Bills (with layout)

```bash
cd ~/Downloads/FSA_DCFSA_Bills/2026-02/

# Convert all PDFs in directory with layout
for pdf in *.pdf; do
  pdftotext -layout "$pdf" "${pdf%.pdf}.txt"
  echo "Converted: $pdf → ${pdf%.pdf}.txt"
done
```

### Extract Specific Pages (with layout)

```bash
# Extract pages 1-3 from a 10-page PDF, preserving layout
pdftotext -layout -f 1 -l 3 report.pdf report_pages1-3.txt
```

---

## Troubleshooting

### Command not found

```
pdftotext: command not found
```

Solution: Install poppler (see Prerequisites)

### Garbled output

If text is corrupted, try specifying encoding:
```bash
pdftotext -enc UTF-8 input.pdf output.txt
```

### Poor layout preservation

If layout doesn't look right, add `-layout` flag:
```bash
pdftotext -layout input.pdf output.txt
```

### File permission denied

```
pdftotext: cannot open output file
```

Solution: Check write permissions in the directory
```bash
chmod 755 /path/to/directory
```

---

## Performance Tips

1. **Use `-layout` for structured documents** (statements, tables)
2. **Suppress output with `-q`** for batch operations
3. **Limit page range with `-f` and `-l`** for large PDFs to extract only needed pages

---

## Return Codes

- `0` - Success
- `1` - Error opening input file
- `2` - Error creating output file
- `99` - Other error

Check return code in scripts:
```bash
pdftotext input.pdf output.txt
if [ $? -eq 0 ]; then
  echo "Conversion successful"
else
  echo "Conversion failed"
fi
```

---

## Related Skills

- **pdf-to-png** - Same Poppler package; use when you need per-page images instead of text
- **fsa-dcfsa-claims-automation** - Uses this skill for statement ingestion
- **mongodb-local** - Store converted text data

---

## Additional Resources

- [Poppler Documentation](https://poppler.freedesktop.org/)
- [pdftotext Manual](https://www.unix.com/man-page/linux/1/pdftotext/)
