-- ============================================================
-- Migration: deduplicate clients and enforce unique names
-- ============================================================
-- Step 1: For each group of rows sharing the same (trimmed, lower-cased) name,
--         keep only the row with the most complete data (has tin_number / start_date).
--         If multiple rows tie, keep the most recently created one.
-- ============================================================

DELETE FROM public.clients
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      -- Rank within each group of duplicate names:
      -- rank 1 = most complete row (has TIN wins, then has start_date, then latest created_at)
      ROW_NUMBER() OVER (
        PARTITION BY lower(trim(name))
        ORDER BY
          CASE WHEN tin_number IS NOT NULL AND tin_number <> '' THEN 0 ELSE 1 END ASC,
          CASE WHEN start_date IS NOT NULL AND start_date <> '' THEN 0 ELSE 1 END ASC,
          created_at DESC NULLS LAST
      ) AS rn
    FROM public.clients
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- Step 2: Trim any accidental whitespace from existing names
-- ============================================================
UPDATE public.clients
SET name = trim(name)
WHERE name <> trim(name);

-- ============================================================
-- Step 3: Add a UNIQUE constraint so this can never happen again
-- ============================================================
ALTER TABLE public.clients
  ADD CONSTRAINT clients_name_unique UNIQUE (name);
