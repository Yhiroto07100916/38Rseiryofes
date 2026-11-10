import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatJstDateTimeLocal,
  jstDateKey,
  jstDateTimeLocalToIso,
} from '../app/utils/jst.ts'

test('converts configured time zones to UTC and back', () => {
  const tokyo = jstDateTimeLocalToIso('2026-01-01T12:00', 'Asia/Tokyo')
  const newYork = jstDateTimeLocalToIso('2026-01-01T12:00', 'America/New_York')

  assert.equal(tokyo, '2026-01-01T03:00:00.000Z')
  assert.equal(newYork, '2026-01-01T17:00:00.000Z')
  assert.equal(formatJstDateTimeLocal(newYork, 'America/New_York'), '2026-01-01T12:00')
  assert.equal(jstDateKey(newYork, 'America/New_York'), '2026-01-01')
})

test('rejects local times that do not exist during a daylight-saving transition', () => {
  assert.throws(
    () => jstDateTimeLocalToIso('2026-03-08T02:30', 'America/New_York'),
    /does not exist/,
  )
})
