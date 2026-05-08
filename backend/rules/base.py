from models import Finding, Severity

SEVERITY_DEDUCTIONS = {
    Severity.CRITICAL: 20,
    Severity.HIGH: 10,
    Severity.MEDIUM: 5,
    Severity.LOW: 2,
    Severity.INFO: 1,
}

RuleFunc = callable  # (lines: list[str]) -> Finding | None
