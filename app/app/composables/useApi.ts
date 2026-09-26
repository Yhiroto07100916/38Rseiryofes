export interface TaskAssignmentUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

export interface TaskAssignmentRole {
  id: string
  name: string
  description: string | null
}

export interface TaskAssignments {
  users: TaskAssignmentUser[]
  roles: TaskAssignmentRole[]
}

export interface Task {
  id: string
  title: string
  description: string | null
  scope: 'class_representative' | 'class'
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  assignments: TaskAssignments
}

export interface TaskListResponse {
  tasks: Task[]
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_nickname: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface TaskCommentsResponse {
  comments: TaskComment[]
}

export const useApi = () => {
  const config = useRuntimeConfig()

  const apiFetch = <T>(
    path: string,
    options: Parameters<typeof $fetch<T>>[1] = {},
  ) => {
    const headers = new Headers(
      (options as RequestInit).headers,
    )

    if (import.meta.server) {
      const requestHeaders = useRequestHeaders([
        'cookie',
      ])

      if (requestHeaders.cookie) {
        headers.set('cookie', requestHeaders.cookie)
      }
    }

    return $fetch<T>(path, {
      baseURL: config.public.apiBaseUrl,
      credentials: 'include',
      ...options,
      headers,
    })
  }

  const getTasks = (scope?: Task['scope']) => {
    const query = scope
      ? `?scope=${encodeURIComponent(scope)}`
      : ''

    return apiFetch<TaskListResponse>(
      `/api/tasks${query}`,
    )
  }

  const getTask = (taskId: string) => {
    return apiFetch<Task>(
      `/api/tasks/${taskId}`,
    )
  }

  const getTaskComments = (taskId: string) => {
    return apiFetch<TaskCommentsResponse>(
      `/api/tasks/${taskId}/comments`,
    )
  }

  return {
    apiFetch,
    getTasks,
    getTask,
    getTaskComments,
  }
}
