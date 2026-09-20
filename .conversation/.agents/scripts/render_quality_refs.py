from pathlib import Path
import fitz

FILES = [
    "attached_assets/307201724-SISTEM-MANAJEMEN-MUTU-KONSTRUKSI_1789871588749.pdf",
    "attached_assets/385424816-Project-Quality-Management_1789871630893.pdf",
    "attached_assets/421525387-Bahan-Test-Kerja-QC_1789871630897.pdf",
]

out = Path(".agents/outputs/quality_refs")
out.mkdir(parents=True, exist_ok=True)

for file_name in FILES:
    path = Path(file_name)
    doc = fitz.open(path)
    stem = path.stem[:40]
    for page_no in range(min(2, doc.page_count)):
        page = doc.load_page(page_no)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / f"{stem}-page-{page_no + 1}.png")
    print(f"{path.name}: {doc.page_count} pages rendered={min(2, doc.page_count)}")