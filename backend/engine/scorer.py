from models import Finding, Severity, ScanSummary

DEDUCTIONS = {
    Severity.CRITICAL: 20,
    Severity.HIGH: 10,
    Severity.MEDIUM: 5,
    Severity.LOW: 2,
    Severity.INFO: 1,
}

GRADES = [
    (90, "A"),
    (75, "B"),
    (60, "C"),
    (40, "D"),
    (0,  "F"),
]


def calculate_score(findings: list[Finding]) -> tuple[int, str, ScanSummary]:
    summary = ScanSummary()
    deduction = 0
    for f in findings:
        deduction += DEDUCTIONS[f.severity]
        match f.severity:
            case Severity.CRITICAL: summary.critical += 1
            case Severity.HIGH:     summary.high += 1
            case Severity.MEDIUM:   summary.medium += 1
            case Severity.LOW:      summary.low += 1
            case Severity.INFO:     summary.info += 1

    score = max(0, 100 - deduction)
    grade = next(g for threshold, g in GRADES if score >= threshold)
    return score, grade, summary
