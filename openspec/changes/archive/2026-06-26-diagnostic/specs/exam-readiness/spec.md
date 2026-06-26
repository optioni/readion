## MODIFIED Requirements

### Requirement: Mock exam results weighted higher than session quizzes

The system SHALL fold submitted/expired `MockExam` results of `type: mock` into readiness with greater weight than ordinary session-quiz performance. Diagnostic attempts (`type: diagnostic`) SHALL be EXCLUDED from this higher-weighted mock blend; a diagnostic seeds readiness only through the recency-decayed `WeakArea` path (low weight, fast decay) per SPEC, so its 10–15-question sample does not carry the elevated weight reserved for real mocks. Mock results SHALL be an optional input: when an enrollment has no `type: mock` results, readiness SHALL still compute from quiz/diagnostic signal alone.

#### Scenario: A mock result shifts readiness more than an equivalent quiz result

- **WHEN** an enrollment is calibrated and then records a strong `type: mock` result, versus an otherwise-identical enrollment that records an equivalent amount of strong session-quiz performance
- **THEN** the enrollment with the mock result has a readiness score at least as high, reflecting the mock's higher weight

#### Scenario: Readiness computes without any mocks

- **WHEN** a calibrated enrollment has no `type: mock` results
- **THEN** readiness still returns a numeric score from its quiz/diagnostic signal

#### Scenario: A diagnostic does not carry the elevated mock weight

- **WHEN** an enrollment records only a `type: diagnostic` result, versus an otherwise-identical enrollment that records an equivalent `type: mock` result, both calibrated
- **THEN** the diagnostic-only enrollment's readiness reflects the diagnostic only through its recency-decayed `WeakArea` contribution and not the higher mock blend, so it is no higher than the mock enrollment's readiness for an equivalent result
