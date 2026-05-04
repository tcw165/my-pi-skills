# pdf-to-png test fixtures

## `sample.pdf`

A tiny 2-page PDF used by `//pdf-to-png/tests:pdf_to_png_e2e_test` to verify the
skill produces `page-1.png` and `page-2.png` from `pdftoppm`.

### Regenerate

The fixture was generated on macOS with the system `cupsfilter`:

```bash
mkdir -p /tmp/pdfgen
printf 'Sample PDF Page 1\n\nFirst page of the pdf-to-png test fixture.\f' > /tmp/pdfgen/in.txt
printf 'Sample PDF Page 2\n\nSecond page.\n' >> /tmp/pdfgen/in.txt
/usr/sbin/cupsfilter -m application/pdf /tmp/pdfgen/in.txt > pdf-to-png/testdata/sample.pdf
```

The `\f` (form-feed) splits the input into two pages. Output is ~16 KB.

Any small multi-page PDF works as a replacement — the test only asserts that
`pdftoppm` emits one PNG per page with valid PNG magic bytes.
