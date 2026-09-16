import math

def get_float(prompt, min_val=None):
    while True:
        try:
            val = float(input(prompt))
            if min_val is not None and val < min_val:
                print(f"Value must be >= {min_val}")
                continue
            return val
        except ValueError:
            print("Invalid number. Try again.")

def get_yes_no(prompt):
    while True:
        ans = input(prompt + " (y/n): ").strip().lower()
        if ans in ['y', 'yes']:
            return True
        elif ans in ['n', 'no']:
            return False
        else:
            print("Please answer y or n.")

def main():
    print("=== Wellpoint Dewatering Sizing Calculator ===\n")
    LL = get_float("Land Length (m): ", 0.1)
    LW = get_float("Land Width (m): ", 0.1)
    L = get_float("Excavation Length (m): ", 0.1)
    W = get_float("Excavation Width (m): ", 0.1)
    D = get_float("Excavation Depth (m): ", 0.1)
    WT = get_float("Static Water Table Depth (m b.g.l.): ", 0)
    Rd = get_float("Required Drawdown (m below pit base): ", 0)
    ingress = get_yes_no("Ingress required?")
    ingress_width = 0
    if ingress:
        ingress_width = get_float("Ingress width (m, min 6.0): ", 6.0)

    # Validation
    if LL <= L:
        print(f"ERROR: Land length ({LL}m) must be greater than excavation length ({L}m).")
        return
    if LW <= W:
        print(f"ERROR: Land width ({LW}m) must be greater than excavation width ({W}m).")
        return

    # Step 1: Dewatering check
    target = D + 0.5
    if (WT - Rd) >= target:
        print("\nDewatering not required. Water table is already sufficiently low.")
        return

    # Step 2: Offset
    offset_L = (LL - L) / 2
    offset_W = (LW - W) / 2
    design_offset = min(1.0, offset_L, offset_W)
    if design_offset < 0.1:
        print(f"ERROR: Excavation nearly touches boundary. Only {design_offset:.2f}m space available. No space for wellpoints.")
        return
    if design_offset < 1.0:
        print(f"WARNING: Only {design_offset:.2f}m setback available. Recommended is 1.0m. Use spade-end wellpoints or seek boundary access permission.")

    # Step 3: Effective perimeter
    eff_L = L + 2 * design_offset
    eff_W = W + 2 * design_offset
    P = 2 * (eff_L + eff_W)

    # Step 4: Filters
    filters = math.ceil(P / 1.0)

    # Step 5: Pumps
    pumps = max(1, math.ceil(P / 60))

    # Step 6: Header length
    base_header = P + pumps * 2.0
    final_header = math.ceil(base_header * 1.10)

    # Step 7: Header breakdown
    full_6m = final_header // 6
    remainder = final_header - (full_6m * 6)
    if remainder == 0:
        headers_6m = full_6m
        headers_3m = 0
    elif remainder <= 3:
        headers_6m = full_6m
        headers_3m = 1
    else:
        headers_6m = full_6m + 1
        headers_3m = 0

    # Step 8: Elbows
    elbows = 3 if ingress else 4

    # Step 9: Tees
    tees = pumps + 3 if ingress else pumps + 1

    # Output
    print("\n=== RESULTS ===")
    print(f"Dewatering Status: Required")
    print(f"Design Offset Used: {design_offset:.2f} m")
    print(f"Effective Loop Perimeter: {P:.2f} m")
    print(f"Filters (1.0m c/c): {filters}")
    print(f"Pumps (100 m³/hr, max 60m header): {pumps}")
    print(f"Headers (6m): {headers_6m}")
    print(f"Headers (3m): {headers_3m}")
    print(f"90° Elbows: {elbows}")
    print(f"Tee Connectors: {tees}")
    if ingress:
        print(f"Ingress Width: {ingress_width:.2f} m")
    print("\nAuto-Summary:")
    summary = f"Ring-main shall be installed at {design_offset:.2f}m offset from pit edge."
    if design_offset < 1.0:
        summary += " Verify clearance with site surveyor."
    summary += " Pumps shall maintain a continuous ring-main; confirm ingress break points prior to installation."
    print(summary)

if __name__ == "__main__":
    main()
