// Printable event summary: a full-width header (logo + title), then the notes in two balanced
// columns, then the numbered segments in a two-column table (one segment per cell, row by row).
//
// All data arrives as JSON through `sys.inputs.data` (see `TypstPdfRenderer`) and is only ever
// printed as text, never evaluated as markup. The one exception is the notes markdown, rendered
// by the vendored `cmarker` with `raw-typst: false` so it can't smuggle Typst code in.
//
// Texts wrapped as `text(...)<label>` are what `event-summary.template.spec.ts` reads back.

#import "vendor/cmarker/lib.typ" as cmarker

#let data = json(bytes(sys.inputs.data))
#let event = data.event

// Design-system tokens (libs/ui/src/lib/tokens/fixed-colors.ts). The page itself stays plain
// white: colour only goes on text and rules.
#let ink = rgb("#1C1B18") // INK.black
#let muted = rgb("#5A5750") // INK.mid
#let rule-color = rgb("#D8D3C8") // CREASE.light
#let numeral-color = rgb("#E5DFD3") // PAPER.washiDark

// Display serif for titles (FONT_FAMILY.serif); body text stays Quicksand.
#let serif = "Fraunces 9pt"

#set document(title: event.title)
#set page(
  paper: "a4",
  margin: (x: 14mm, top: 14mm, bottom: 16mm),
  footer: context {
    set text(size: 7.5pt, fill: muted)
    event.title
    [ · ]
    [#text(event.date)<footer-date>]
    h(1fr)
    counter(page).display("1 / 1", both: true)
  },
)
#set text(font: "Quicksand", weight: 500, size: 9pt, lang: "ca", fill: ink)
#set par(leading: 0.55em, spacing: 0.9em)

// Quicksand has no italic cut, so emphasis is underlined instead of faked.
#show emph: it => underline(offset: 1.5pt, it.body)
// Code stays in Quicksand (Atkinson Hyperlegible is reserved for the projection view), framed
// by a hairline so it still stands apart from the text.
#show raw: set text(font: "Quicksand", size: 1em)
#show raw.where(block: false): it => box(stroke: 0.5pt + rule-color, radius: 2pt, inset: (x: 2pt), outset: (y: 2pt), it)
#show raw.where(block: true): it => block(width: 100%, stroke: 0.5pt + rule-color, radius: 2pt, inset: 6pt, it)
#show quote.where(block: true): it => block(
  inset: (left: 8pt, y: 2pt),
  stroke: (left: 1.5pt + rule-color),
  text(fill: muted, it.body),
)
#show heading: set block(above: 1em, below: 0.5em)
// Sections in the display serif, subsections in bold Quicksand, so the two levels never read alike.
#show heading: set text(weight: "bold", size: 10pt)
#show heading.where(level: 1): set text(font: serif, weight: "semibold", size: 14pt)
#show heading.where(level: 2): set text(font: serif, weight: "semibold", size: 12pt)

// ── Header (full width) ─────────────────────────────────────────────────────────────────────

#let meta = (
  (event.date, event.startTime, event.location)
    .filter(value => value != none)
    .join(" · ")
)

#block(width: 100%, inset: (bottom: 8pt), stroke: (bottom: 0.8pt + rule-color), below: 12pt)[
  #grid(
    columns: (auto, 1fr),
    column-gutter: 10pt,
    align: horizon,
    [#image("logo.svg", height: 14mm)<app-logo>],
    // Title and subtitle sized to roughly the logo's height, so the gap between them reads
    // as part of one unit rather than tighter than the space around it.
    stack(
      spacing: 8pt,
      text(font: serif, size: 18pt, weight: "semibold", top-edge: "cap-height", bottom-edge: "baseline")[#text(event.title)<event-title>],
      text(size: 9pt, fill: muted, top-edge: "cap-height", bottom-edge: "baseline")[#text(meta)<event-meta>],
    ),
  )
]

// ── Notes, then segments ───────────────────────────────────────────────────────────────────

#let column-gutter = 8mm
// Bottom of the text area: A4 height minus the bottom margin set on the page above.
#let page-bottom = 297mm - 16mm

#let two-columns(body) = columns(2, gutter: column-gutter, body)

// Typst's columns never balance (typst#466): short content fills the left column and leaves
// the right one empty. So for content that fits on the rest of the page we split it ourselves.
//
// 1. Group the content into blocks: headings, lists, quotes, tables… and the paragraphs between
//    paragraph breaks. Only split between blocks, never inside one.
// 2. Measure every prefix and suffix at column width. Blocks are measured together, not summed,
//    because the spacing between them only exists when they're laid out together.
// 3. Cut where the taller half is shortest (ties keep the left side longer), and never leave a
//    heading at the bottom of the left column.
// Content taller than the rest of the page flows through ordinary columns instead: a fixed
// split can't continue onto the next page in reading order.
#let block-kinds = (heading, list, enum, terms, quote, table, figure, line, block, raw)

#let content-blocks(body) = {
  let children = if body.func() == [].func() { body.children } else { (body,) }
  let blocks = ()
  let run = ()
  for child in children + (parbreak(),) {
    let is-block = child.func() in block-kinds
    if is-block or child.func() == parbreak {
      if run.any(c => c.func() != [ ].func()) { blocks.push(run.join()) }
      run = ()
      if is-block { blocks.push(child) }
    } else {
      run.push(child)
    }
  }
  blocks
}

#let balanced-columns(body) = layout(region => context {
  let width = (region.width - column-gutter) / 2
  let height(items) = if items.len() == 0 { 0pt } else { measure(block(width: width, items.join())).height }
  let blocks = content-blocks(body)
  let remaining = page-bottom - here().position().y

  if blocks.len() == 0 or height(blocks) / 2 > remaining {
    return two-columns(body)
  }

  let split = 1
  let best = height(blocks)
  for k in range(1, blocks.len()) {
    let taller = calc.max(height(blocks.slice(0, k)), height(blocks.slice(k)))
    if taller <= best { best = taller; split = k }
  }
  while split > 1 and blocks.at(split - 1).func() == heading { split -= 1 }

  let (left, right) = (blocks.slice(0, split), blocks.slice(split))
  if calc.max(height(left), height(right)) > remaining {
    return two-columns(body)
  }
  grid(
    columns: (1fr, 1fr),
    column-gutter: column-gutter,
    [#block(left.join())<notes-left>],
    [#block(right.join())<notes-right>],
  )
})

#if data.notes != none {
  let notes = cmarker.render(
    data.notes,
    raw-typst: false,
    // A markdown image would make Typst load a file (and fail the whole compile if missing):
    // print its alt text instead.
    scope: (image: (source, alt: none, ..args) => if alt != none { alt }),
  )
  [#balanced-columns(notes)<notes-columns>]
  // No section titles any more, so leave clear air between the notes and the segments table.
  v(10pt)
}

#let segment-cell(segment) = [
  // The number floats in the top-left corner, behind the text, so the cell stays centred.
  #place(top + left, dx: -3pt, dy: -3pt, text(
    font: serif, size: 30pt, weight: "semibold", fill: numeral-color, top-edge: "cap-height", bottom-edge: "baseline",
  )[#text(str(segment.number))<segment-number>])
  #text(size: 11pt, weight: "bold")[#text(segment.title)<segment-title>]
  #for (index, figure) in segment.figures.enumerate() {
    let lines = ()
    if figure.label != none {
      lines.push(text(weight: "bold")[#text(figure.label)<figure-label>])
    }
    if figure.directions != none {
      lines.push(text(fill: muted)[\[#text(figure.directions)<figure-directions>\]])
    }
    for line in (if figure.tronc == none { () } else { figure.tronc }) {
      lines.push(text(size: 11pt)[#text(line)<figure-tronc>])
    }
    // A short hairline marks where the next figure starts (the names may be hidden, when the
    // segment title already says them).
    if index > 0 {
      block(above: 7pt, below: 0pt)[#line(length: 25%, stroke: 0.5pt + rule-color)<figure-separator>]
    }
    block(width: 100%, above: 7pt, lines.join(linebreak()))
  }
]

// One segment per cell, filled row by row (1 2 / 3 4 / 5 _); an odd last row keeps an empty
// cell. A cell never splits across a page break.
#if data.segments.len() == 0 {
  text(fill: muted)[#text("Este esdeveniment no té segments.")<empty-segments>]
} else [
  #table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + rule-color,
    inset: 7pt,
    align: top + center,
    ..data.segments.map(segment => table.cell(breakable: false, segment-cell(segment))),
  )<segments-table>
]
