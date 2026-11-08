ALTER TABLE tool_rental_loans
  ADD COLUMN tool_name_snapshot TEXT;

UPDATE tool_rental_loans
SET tool_name_snapshot = (
  SELECT name
  FROM tool_rental_tools
  WHERE tool_rental_tools.id = tool_rental_loans.tool_id
)
WHERE tool_name_snapshot IS NULL;
