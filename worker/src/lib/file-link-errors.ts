export function isFileLinkConflict(error: unknown): boolean {
  const messages: string[] = []
  const visited = new Set<unknown>()

  const inspect = (value: unknown): void => {
    if (value === null || value === undefined || visited.has(value)) {
      return
    }

    if (typeof value === "string") {
      messages.push(value)
      return
    }

    if (typeof value !== "object") {
      messages.push(String(value))
      return
    }

    visited.add(value)

    const record = value as Record<string, unknown>

    if (typeof record.message === "string") {
      messages.push(record.message)
    }

    if (typeof record.cause === "string") {
      messages.push(record.cause)
    } else {
      inspect(record.cause)
    }
  }

  inspect(error)

  return messages.some((message) =>
    message.includes("FILE_LINK_CONFLICT"),
  )
}
