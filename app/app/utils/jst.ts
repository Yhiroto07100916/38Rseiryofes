const DEFAULT_TIME_ZONE = 'Asia/Tokyo'

function getDateParts(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): Record<string, string> {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value')
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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

/** ISO日時を指定タイムゾーンの datetime-local 用文字列に変換する */
export function formatJstDateTimeLocal(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const parts = getDateParts(value, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** datetime-local の入力値を指定タイムゾーンとして解釈し、ISO UTC日時に変換する */
export function jstDateTimeLocalToIso(
  value: string,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)

  if (!match) {
    throw new Error('Invalid datetime-local value')
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fractionText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const milliseconds = Number(fractionText.padEnd(3, '0'))

  const target = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds)
  const calendarValidation = new Date(target)

  if (
    calendarValidation.getUTCFullYear() !== year ||
    calendarValidation.getUTCMonth() !== month - 1 ||
    calendarValidation.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new Error('Invalid calendar date or time')
  }

  let candidate = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getDateParts(new Date(candidate), timeZone)
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      milliseconds,
    )
    const difference = target - represented
    if (difference === 0) break
    candidate += difference
  }

  const finalParts = getDateParts(new Date(candidate), timeZone)
  if (
    Number(finalParts.year) !== year ||
    Number(finalParts.month) !== month ||
    Number(finalParts.day) !== day ||
    Number(finalParts.hour) !== hour ||
    Number(finalParts.minute) !== minute ||
    Number(finalParts.second) !== second
  ) {
    throw new Error('The selected local time does not exist in this time zone')
  }

  return new Date(candidate).toISOString()
}

/** 日時を指定タイムゾーンで表示する */
export function formatJstDateTime(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

/** 日付を指定タイムゾーンで表示する */
export function formatJstDate(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(value instanceof Date ? value : new Date(value))
}

/** 日時から指定タイムゾーンの日付キー YYYY-MM-DD を取得する */
export function jstDateKey(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const parts = getDateParts(value, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}
