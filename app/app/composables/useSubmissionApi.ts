export type SubmissionStatus =
  | 'preparing'
  | 'ready_to_submit'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'resubmitted'
  | 'completed'
  | 'cancelled'

export interface SubmissionRole {
  id: string
  name: string
}

export interface SubmissionFile {
  id: string
  original_name: string
  content_type: string
  size: number
}

export interface Submission {
  id: string
  title: string
  description: string | null
  destination: string
  due_at: string | null
  assigned_role_id: string | null
  assigned_role_name?: string | null
  status: SubmissionStatus
  created_by: string
  creator_name: string | null
  created_at: string
  updated_at: string
  version: number
  record_count: number
  latest_submitted_at: string | null
}

export interface SubmissionRecord {
  id: string
  submission_id: string
  attempt_number: number
  submitted_by: string
  submitted_by_name: string | null
  submitted_at: string
  note: string | null
  files: string | SubmissionFile[] | null
}

export interface SubmissionHistory {
  id: string
  submission_id: string
  actor_id: string
  actor_name: string | null
  action: string
  from_status: SubmissionStatus | null
  to_status: SubmissionStatus | null
  details: string | null
  created_at: string
}

export interface SubmissionDetailResponse {
  submission: Submission
  records: SubmissionRecord[]
  history: SubmissionHistory[]
}

export interface UploadedSubmissionFile {
  id: string
  object_key: string
  original_name: string
  content_type: string
  size: number
  category: string
  uploaded_by: string
}

export const useSubmissionApi = () => {
  const { apiFetch } = useApi()

  const getSubmissions = () =>
    apiFetch<{ submissions: Submission[] }>('/api/submissions')

  const getSubmissionRoles = () =>
    apiFetch<{ roles: SubmissionRole[] }>('/api/submissions/roles')

  const getSubmission = (id: string) =>
    apiFetch<SubmissionDetailResponse>(`/api/submissions/${id}`)

  const createSubmission = (data: {
    title: string
    destination: string
    description?: string | null
    due_at?: string | null
    assigned_role_id?: string | null
  }) =>
    apiFetch<{ id: string; status: SubmissionStatus }>('/api/submissions', {
      method: 'POST',
      body: data,
    })

  const updateSubmission = (
    id: string,
    data: {
      title?: string
      destination?: string
      description?: string | null
      due_at?: string | null
      assigned_role_id?: string | null
    },
  ) =>
    apiFetch<{ ok: boolean; version: number }>(`/api/submissions/${id}`, {
      method: 'PATCH',
      body: data,
    })

  const uploadSubmissionFile = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'uploads')

    return apiFetch<UploadedSubmissionFile>('/api/files', {
      method: 'POST',
      body: formData,
    })
  }

  const submitSubmission = (
    id: string,
    data: {
      note?: string
      file_ids?: string[]
    },
  ) =>
    apiFetch<{
      id: string
      attempt_number: number
      status: SubmissionStatus
      version: number
    }>(`/api/submissions/${id}/records`, {
      method: 'POST',
      body: data,
    })

  const updateSubmissionStatus = (
    id: string,
    action:
      | 'ready_to_submit'
      | 'start_review'
      | 'request_changes'
      | 'complete'
      | 'cancel',
    note?: string,
  ) =>
    apiFetch<{
      ok: boolean
      status: SubmissionStatus
      version: number
    }>(`/api/submissions/${id}/status`, {
      method: 'PATCH',
      body: { action, note },
    })

  const downloadSubmissionFile = async (
    submissionId: string,
    fileId: string,
    fileName: string,
  ) => {
    const blob = await apiFetch<Blob>(
      `/api/submissions/${submissionId}/files/${fileId}`,
      { responseType: 'blob' },
    )

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return {
    getSubmissions,
    getSubmissionRoles,
    getSubmission,
    createSubmission,
    updateSubmission,
    uploadSubmissionFile,
    submitSubmission,
    updateSubmissionStatus,
    downloadSubmissionFile,
  }
}
