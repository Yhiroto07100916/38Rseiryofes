export interface CalendarCategory {
  id: string
  name: string
  color: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

export interface CalendarCategoryListResponse {
  categories: CalendarCategory[]
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  is_all_day: number
  location: string | null
  color: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CalendarAttendanceStatus =
  | 'attending'
  | 'not_attending'
  | 'undecided'

export interface CalendarEventAttendance {
  event_id: string
  my_status: CalendarAttendanceStatus | null
  counts: {
    attending: number
    not_attending: number
    undecided: number
  }
}


export interface NewsCalendarEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  is_all_day: number
  location: string | null
  color: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null
}

export interface NewsTask {
  id: string
  title: string
  description: string | null
  scope: Task["scope"]
  status: Task["status"]
  priority: Task["priority"]
  due_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface NewsAttachment {
  id: string
  news_id: string
  file_name: string
  file_key: string
  content_type: string | null
  file_size: number | null
  created_at: string
}

export interface News {
  id: string
  title: string
  detail: string
  author: string
  is_important: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface NewsWithCalendarEvents extends News {
  calendar_events: NewsCalendarEvent[]
  tasks: NewsTask[]
  attachments: NewsAttachment[]
}

export interface CalendarEventListResponse {
  events: CalendarEvent[]
}

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

  const updateTask = (
    taskId: string,
    data: {
      status?: Task['status']
      priority?: Task['priority']
    },
  ) => {
    return apiFetch<Task>(
      `/api/tasks/${taskId}`,
      {
        method: 'PATCH',
        body: data,
      },
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

  const getCalendarCategories = () => {
    return apiFetch<CalendarCategoryListResponse>(
      '/api/calendar/categories',
    )
  }

  const getCalendarCategory = (categoryId: string) => {
    return apiFetch<CalendarCategory>(
      `/api/calendar/categories/${categoryId}`,
    )
  }

  const createCalendarCategory = (data: {
    name: string
    color: string
    sort_order?: number
    is_active?: boolean
  }) => {
    return apiFetch<CalendarCategory>(
      '/api/calendar/categories',
      {
        method: 'POST',
        body: data,
      },
    )
  }

  const updateCalendarCategory = (
    categoryId: string,
    data: {
      name?: string
      color?: string
      sort_order?: number
      is_active?: boolean
    },
  ) => {
    return apiFetch<CalendarCategory>(
      `/api/calendar/categories/${categoryId}`,
      {
        method: 'PATCH',
        body: data,
      },
    )
  }

  const deleteCalendarCategory = (categoryId: string) => {
    return apiFetch<{ success: boolean }>(
      `/api/calendar/categories/${categoryId}`,
      {
        method: 'DELETE',
      },
    )
  }

  const getCalendarEvents = (
    from: string,
    to: string,
  ) => {
    const query = new URLSearchParams({
      from,
      to,
    })

    return apiFetch<CalendarEventListResponse>(
      `/api/calendar/events?${query.toString()}`,
    )
  }

  const getCalendarEvent = (eventId: string) => {
    return apiFetch<CalendarEvent>(
      `/api/calendar/events/${eventId}`,
    )
  }

  const getCalendarEventAttendance = (
    eventId: string,
  ) => {
    return apiFetch<CalendarEventAttendance>(
      `/api/calendar/events/${eventId}/attendance`,
    )
  }

  const updateCalendarEventAttendance = (
    eventId: string,
    status: CalendarAttendanceStatus,
  ) => {
    return apiFetch<CalendarEventAttendance>(
      `/api/calendar/events/${eventId}/attendance`,
      {
        method: 'PUT',
        body: {
          status,
        },
      },
    )
  }

  const getNews = () => {
    return apiFetch<{ news: News[] }>(
      '/api/news',
    )
  }

  const getNewsById = (newsId: string) => {
    return apiFetch<NewsWithCalendarEvents>(
      `/api/news/${newsId}`,
    )
  }

  const createNews = (data: {
    title: string
    detail: string
    author: string
    is_important?: boolean
    calendar_event_ids?: string[]
    task_ids?: string[]
  }) => {
    return apiFetch<NewsWithCalendarEvents>(
      '/api/news',
      {
        method: 'POST',
        body: data,
      },
    )
  }

  const updateNews = (
    newsId: string,
    data: {
      title?: string
      detail?: string
      author?: string
      is_important?: boolean
      calendar_event_ids?: string[]
      task_ids?: string[]
    },
  ) => {
    return apiFetch<NewsWithCalendarEvents>(
      `/api/news/${newsId}`,
      {
        method: 'PATCH',
        body: data,
      },
    )
  }

  const deleteNews = (newsId: string) => {
    return apiFetch<{ success: boolean; id: string }>(
      `/api/news/${newsId}`,
      {
        method: 'DELETE',
      },
    )
  }

  const createCalendarEvent = (data: {
    title: string
    description?: string | null
    starts_at: string
    ends_at?: string | null
    is_all_day?: boolean
    location?: string | null
    category_id?: string | null
  }) => {
    return apiFetch<CalendarEvent>(
      '/api/calendar/events',
      {
        method: 'POST',
        body: data,
      },
    )
  }

  const updateCalendarEvent = (
    eventId: string,
    data: {
      title?: string
      description?: string | null
      starts_at?: string
      ends_at?: string | null
      is_all_day?: boolean
      location?: string | null
      category_id?: string | null
    },
  ) => {
    return apiFetch<CalendarEvent>(
      `/api/calendar/events/${eventId}`,
      {
        method: 'PATCH',
        body: data,
      },
    )
  }

  const deleteCalendarEvent = (eventId: string) => {
    return apiFetch<{ success: boolean }>(
      `/api/calendar/events/${eventId}`,
      {
        method: 'DELETE',
      },
    )
  }

  return {
    apiFetch,
    getTasks,
    updateTask,
    getTask,
    getTaskComments,
    getCalendarCategories,
    getCalendarCategory,
    createCalendarCategory,
    updateCalendarCategory,
    deleteCalendarCategory,
    getCalendarEvents,
    getCalendarEvent,
    getCalendarEventAttendance,
    updateCalendarEventAttendance,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getNews,
    getNewsById,
    createNews,
    updateNews,
    deleteNews,
  }
}
