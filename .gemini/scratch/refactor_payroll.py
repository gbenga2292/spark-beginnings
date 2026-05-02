import os

file_path = r"c:\Users\USER\Desktop\assign\spark-beginnings\src\pages\Payroll.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Move `buildSlipHtml`, `currency`, `col`, and `themeStyles` out of `handlePrint`
# They start at line 587 (// Build self-contained HTML for every payslip)
# And end before `const html = \`` inside `handlePrint`
start_marker = "      // Build self-contained HTML for every payslip so all appear in one print job"
end_marker = "      const html = `\n    <!DOCTYPE html>"

if start_marker in content and end_marker in content:
    idx_start = content.find(start_marker)
    idx_end = content.find(end_marker)
    
    extracted_block = content[idx_start:idx_end]
    
    # Modify themeStyles within the extracted block
    # CLASSIC: remove Times New Roman
    extracted_block = extracted_block.replace(
        "body { font-family: 'Times New Roman', Times, serif; color: #1a1a1a; }",
        "body, .preview-payslips-wrapper { font-family: sans-serif; color: #1a1a1a; }"
    )
    # FORMAL: change header background to slate-900 (#0f172a)
    extracted_block = extracted_block.replace(
        "body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; }",
        "body, .preview-payslips-wrapper { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; }"
    )
    extracted_block = extracted_block.replace(
        ".formal-header { display: flex; align-items: center; gap: 16px; background: #1e3a5f; color: #fff; padding: 16px 22px; margin-bottom: 0; }",
        ".formal-header { display: flex; align-items: center; gap: 16px; background: #0f172a; color: #fff; padding: 16px 22px; margin-bottom: 0; }"
    )
    extracted_block = extracted_block.replace(
        ".formal-col-header { background: #1e3a5f; color: #fff;",
        ".formal-col-header { background: #0f172a; color: #fff;"
    )
    extracted_block = extracted_block.replace(
        "tfoot td { padding: 7px 12px; font-weight: bold; border-top: 2px solid #1e3a5f; background: #eef3f9; }",
        "tfoot td { padding: 7px 12px; font-weight: bold; border-top: 2px solid #0f172a; background: #f8fafc; }"
    )
    extracted_block = extracted_block.replace(
        ".formal-net { background: #1e3a5f; color: #fff;",
        ".formal-net { background: #0f172a; color: #fff;"
    )
    # MODERN: add .preview-payslips-wrapper
    extracted_block = extracted_block.replace(
        "body { font-family: sans-serif; color: #333; }",
        "body, .preview-payslips-wrapper { font-family: sans-serif; color: #333; }"
    )

    # Now remove the block from inside handlePrint and leave just:
    # const slipsHtml = payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('');
    
    content = content[:idx_start] + "      const slipsHtml = payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('');\n" + content[idx_end:]
    
    # Inject the extracted block right before handlePrint
    handle_print_marker = "    const handlePrint = () => {"
    
    # But wait, we need to adjust indentation of the extracted block so it aligns with handlePrint
    # extracted block currently has 6 spaces. handlePrint has 4 spaces.
    lines = extracted_block.split('\n')
    unindented_lines = []
    for line in lines:
        if line.startswith("  "):
            unindented_lines.append(line[2:])
        else:
            unindented_lines.append(line)
    
    adjusted_block = "\n".join(unindented_lines)
    
    content = content.replace(handle_print_marker, adjusted_block + handle_print_marker)

# 2. Update the preview area to use dangerouslySetInnerHTML
preview_start = "                  ) : printType === 'PAYSLIPS' ? ("
preview_end = "                  ) : printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF' || printType === 'WITHHOLDING' ? (() => {"

if preview_start in content and preview_end in content:
    idx_pstart = content.find(preview_start)
    idx_pend = content.find(preview_end)
    
    new_preview = """                  ) : printType === 'PAYSLIPS' ? (
                    <div className="bg-white mx-auto print-break shadow-sm" style={{ maxWidth: 820 }}>
                      <style>{`.preview-payslips-wrapper { text-align: left; } .preview-payslips-wrapper * { box-sizing: border-box; } ` + themeStyles}</style>
                      <div className="preview-payslips-wrapper" dangerouslySetInnerHTML={{ __html: payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('') }} />
                    </div>
"""
    content = content[:idx_pstart] + new_preview + content[idx_pend:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactor complete.")
