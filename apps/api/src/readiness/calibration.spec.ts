import { describe, expect, it } from 'vitest'
import { isCalibrated } from './calibration'

describe('isCalibrated', () => {
  it('is not calibrated below the threshold with no diagnostic', () => {
    expect(
      isCalibrated({ gradedAnswerCount: 9, hasCompletedDiagnostic: false, threshold: 10 }),
    ).toBe(false)
  })

  it('is calibrated at the threshold', () => {
    expect(
      isCalibrated({ gradedAnswerCount: 10, hasCompletedDiagnostic: false, threshold: 10 }),
    ).toBe(true)
  })

  it('is calibrated above the threshold', () => {
    expect(
      isCalibrated({ gradedAnswerCount: 25, hasCompletedDiagnostic: false, threshold: 10 }),
    ).toBe(true)
  })

  it('is calibrated when a submitted diagnostic exists even below the answer threshold', () => {
    expect(
      isCalibrated({ gradedAnswerCount: 0, hasCompletedDiagnostic: true, threshold: 10 }),
    ).toBe(true)
  })
})
