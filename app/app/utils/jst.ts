const JST_TIME_ZONE = 'Asia/Tokyo'

function getDateParts(value: string | Date): Record<string, string> {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value')
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

/** ISO日時を日本時間の datetime-local 用文字列に変換する */
export function formatJstDateTimeLocal(value: string | Date): string {
  const parts = getDateParts(value)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** datetime-local の入力値を日本時間として解釈し、ISO UTC日時に変換する */
export function jstDateTimeLocalToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)

  if (!match) {
    throw new Error('Invalid JST datetime-local value')
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fractionText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const milliseconds = Number(fractionText.padEnd(3, '0'))

  const validation = new Date(Date.UTC(
    year, month - 1, day, hour, minute, second, milliseconds,
  ))

  if (
    validation.getUTCFullYear() !== year ||
    validation.getUTCMonth() !== month - 1 ||
    validation.getUTCDate() !== day ||
    validation.getUTCHours() !== hour ||
    validation.getUTCMinutes() !== minute ||
    validation.getUTCSeconds() !== second
  ) {
    throw new Error('Invalid JST calendar date or time')
  }

  return new Date(Date.UTC(
    year, month - 1, day, hour - 9, minute, second, milliseconds,
  )).toISOString()
}

/** 日時を日本時間で表示する */
export function formatJstDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

/** 日付を日本時間で表示する */
export function formatJstDate(value: string | Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(value instanceof Date ? value : new Date(value))
}

/** 日時から日本時間の日付キー YYYY-MM-DD を取得する */
export function jstDateKey(value: string | Date): string {
  const parts = getDateParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}
