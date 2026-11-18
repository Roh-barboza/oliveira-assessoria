import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function renderPdf(sections, createdAt) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle('Minuta de teste | Oliveira Assessoria');
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const wine = rgb(0.32, 0.13, 0.21);
  const ink = rgb(0.15, 0.14, 0.15);
  const margin = 48;
  const width = 595.28;
  const height = 841.89;
  let page;
  let y;

  function newPage() {
    page = pdf.addPage([width, height]);
    page.drawText('OLIVEIRA ASSESSORIA', { x: margin, y: height - 52, font: serif, size: 20, color: wine });
    page.drawText('SANDBOX · MINUTA FICTÍCIA SEM VALIDADE', { x: margin, y: height - 74, font: bold, size: 10, color: wine });
    page.drawLine({ start: { x: margin, y: height - 87 }, end: { x: width - margin, y: height - 87 }, thickness: 1, color: wine });
    y = height - 115;
  }

  function line(text, font, size, color) {
    if (y < 60) newPage();
    page.drawText(text, { x: margin, y, font, size, color });
    y -= size + 6;
  }

  newPage();
  for (const [title, paragraph] of sections) {
    if (y < 110) newPage();
    line(title, bold, 12, wine);
    for (const block of paragraph.split('\n')) {
      let row = '';
      for (const word of block.split(' ')) {
        const next = row ? `${row} ${word}` : word;
        if (regular.widthOfTextAtSize(next, 11) <= width - margin * 2) {
          row = next;
        } else {
          line(row, regular, 11, ink);
          row = word;
        }
      }
      if (row) line(row, regular, 11, ink);
    }
    y -= 13;
  }
  return Buffer.from(await pdf.save());
}
