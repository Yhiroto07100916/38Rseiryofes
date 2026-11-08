export interface Tool {
  id: number
  name: string
  category: string | null
  description: string | null
  location: string | null
  quantity: number
  available_quantity: number
  is_active: number
  display_order?: number | null
  created_at: string
  updated_at: string
}

export interface ToolItem {
  id: number
  tool_id: number
  management_number: string
  status: 'available' | 'borrowed' | 'unavailable'
  created_at: string
  updated_at: string
}

export interface CurrentLoanItem {
  loan_item_id: number
  loan_id: number
  tool_id: number
  tool_name: string
  tool_item_id: number
  management_number: string
  class_name: string
  borrower_name: string
  borrowed_at: string
}

export interface LoanHistoryItem {
  loan_item_id: number
  loan_id: number
  tool_name: string
  management_number: string
  class_name: string
  borrower_name: string
  borrowed_at: string
  returned_at: string | null
  returned_by_class_name: string | null
  returned_by_name: string | null
  status: 'borrowed' | 'returned'
}
