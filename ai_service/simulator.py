"""Deterministic, explainable telemetry simulation and anomaly scoring service.

This intentionally uses Python's standard library so the demo can run without
downloading a model or third-party packages. Replace the simulator input with
trusted monitoring-agent observations to use the same analysis pipeline live.
"""

from datetime import datetime, timezone
import math
import uuid

ENTITY_COUNT = 1000
CENTERS = ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Rewa", "Satna"]
SCENARIOS = {
    "NORMAL": {"latency": 48, "packet_loss": .35, "login_failures": 8, "submission_failures": 3, "cpu": 48, "memory": 51, "db_response": 28, "concurrency": 970, "availability": 99.9, "impact": .01, "downtime": 0, "recovery": 0},
    "NETWORK_DEGRADATION": {"latency": 245, "packet_loss": 8.2, "login_failures": 70, "submission_failures": 92, "cpu": 61, "memory": 67, "db_response": 85, "concurrency": 940, "availability": 92, "impact": .29, "downtime": 11, "recovery": 18},
    "LOGIN_SPIKE": {"latency": 110, "packet_loss": 1.2, "login_failures": 150, "submission_failures": 8, "cpu": 78, "memory": 64, "db_response": 52, "concurrency": 1450, "availability": 97, "impact": .16, "downtime": 3, "recovery": 9},
    "SERVER_OVERLOAD": {"latency": 310, "packet_loss": 2.1, "login_failures": 28, "submission_failures": 130, "cpu": 94, "memory": 89, "db_response": 170, "concurrency": 990, "availability": 88, "impact": .38, "downtime": 16, "recovery": 25},
    "DATABASE_SLOWDOWN": {"latency": 185, "packet_loss": .9, "login_failures": 20, "submission_failures": 170, "cpu": 68, "memory": 74, "db_response": 1450, "concurrency": 980, "availability": 94, "impact": .25, "downtime": 8, "recovery": 20},
    "POWER_OUTAGE": {"latency": 520, "packet_loss": 16, "login_failures": 190, "submission_failures": 260, "cpu": 52, "memory": 57, "db_response": 290, "concurrency": 710, "availability": 76, "impact": .34, "downtime": 22, "recovery": 38},
}


def clamp(value, low=0, high=100):
    return max(low, min(high, value))


def normalized_risks(m):
    # Piecewise thresholds keep each measurement interpretable and bounded.
    return {
        "latency": clamp((m["latency_ms"] - 50) / 4.5),
        "packet_loss": clamp(m["packet_loss_pct"] * 12),
        "login_failures": clamp(m["login_failures"] / 1.8),
        "submission_failures": clamp(m["submission_failures"] / 1.8),
        "server_health": clamp(max((m["cpu_pct"] - 45) / .55, (m["memory_pct"] - 50) / .5)),
        "database": clamp((m["db_response_ms"] - 30) / 14),
        "concurrency": clamp(max(0, m["concurrent_users"] - 1000) / 10),
        "availability": clamp((99.9 - m["availability_pct"]) * 5),
    }


def analyze(scenario):
    profile = SCENARIOS[scenario]
    # Scenario profiles are deliberately repeatable so a demo can be rehearsed
    # and compared without random telemetry obscuring the response.
    entities = []
    for index in range(ENTITY_COUNT):
        center_index = min(len(CENTERS) - 1, index * len(CENTERS) // ENTITY_COUNT)
        impacted_count = 0 if scenario == "NORMAL" else round(ENTITY_COUNT * profile["impact"])
        impacted = index < impacted_count
        severity = .9 + (index % 21) / 100
        entities.append({"id": f"CAND-{index + 1:04d}", "center": CENTERS[center_index], "impacted": impacted,
                         "latency": max(5, profile["latency"] * severity),
                         "risk": 0})

    impacted = sum(item["impacted"] for item in entities)
    metrics = {
        "latency_ms": profile["latency"],
        "packet_loss_pct": profile["packet_loss"],
        "login_failures": profile["login_failures"],
        "submission_failures": profile["submission_failures"],
        "cpu_pct": profile["cpu"],
        "memory_pct": profile["memory"],
        "db_response_ms": profile["db_response"],
        "concurrent_users": profile["concurrency"],
        "availability_pct": profile["availability"],
        "registered_students": ENTITY_COUNT,
        "active_students": ENTITY_COUNT - (round(ENTITY_COUNT * .12) if scenario == "POWER_OUTAGE" else 0),
        "power_status": "OUTAGE" if scenario == "POWER_OUTAGE" else "STABLE",
    }
    parts = normalized_risks(metrics)
    weights = {"latency": .16, "packet_loss": .16, "login_failures": .10, "submission_failures": .15,
               "server_health": .13, "database": .12, "concurrency": .08, "availability": .10}
    raw = sum(parts[key] * weights[key] for key in weights)
    # A serious single signal must not disappear in a weighted average.
    current_score = round(max(raw, max(parts.values()) * .90))
    moving_average = current_score
    trend = "STABLE"
    score = current_score
    status = "CRITICAL" if score >= 75 else "AT_RISK" if score >= 45 else "NORMAL"

    evidence = []
    if metrics["packet_loss_pct"] >= 2 or metrics["latency_ms"] >= 150:
        evidence.append(("Network degradation", parts["packet_loss"] * .55 + parts["latency"] * .45,
                         [f"Latency is {metrics['latency_ms']} ms", f"Packet loss is {metrics['packet_loss_pct']}%"] ))
    if metrics["cpu_pct"] >= 80 or metrics["memory_pct"] >= 82:
        evidence.append(("Server overload", parts["server_health"] * .7 + parts["latency"] * .3,
                         [f"CPU is {metrics['cpu_pct']}%", f"Memory is {metrics['memory_pct']}%"] ))
    if metrics["db_response_ms"] >= 500 or metrics["submission_failures"] >= 60:
        evidence.append(("Database slowdown", parts["database"] * .65 + parts["submission_failures"] * .35,
                         [f"Database response is {metrics['db_response_ms']} ms", f"Submission failures: {metrics['submission_failures']}"] ))
    if metrics["login_failures"] >= 60 or (metrics["concurrent_users"] > 1300 and metrics["login_failures"] >= 25):
        evidence.append(("Authentication surge", parts["login_failures"] * .7 + parts["concurrency"] * .3,
                         [f"Login failures: {metrics['login_failures']}", f"Concurrent users: {metrics['concurrent_users']}"] ))
    if metrics["availability_pct"] < 85 and metrics["active_students"] < ENTITY_COUNT:
        evidence.append(("Power loss at an exam center", parts["availability"] * .65 + parts["submission_failures"] * .35,
                         [f"Availability is {metrics['availability_pct']}%", f"Power state: {metrics['power_status']}"] ))
    if not evidence:
        root_cause = "No significant incident"
        cause_evidence = ["Signals remain inside the configured baseline envelope."]
    elif scenario == "POWER_OUTAGE":
        root_cause, _, cause_evidence = next(entry for entry in evidence if entry[0] == "Power loss at an exam center")
    else:
        root_cause, _, cause_evidence = max(evidence, key=lambda entry: entry[1])

    recommendations = {
        "Network degradation": ["Route affected centers through a secondary ISP path.", "Buffer and retry submissions with idempotency keys."],
        "Server overload": ["Scale application workers and shed non-essential telemetry load.", "Check CPU throttling, memory pressure, and garbage-collection pauses."],
        "Database slowdown": ["Inspect connection-pool saturation, slow queries, and write locks.", "Keep submissions queued until database writes recover."],
        "Authentication surge": ["Rate-limit retries and spread login traffic with admission control.", "Scale authentication workers and inspect identity-provider latency."],
        "Power loss at an exam center": ["Switch the center to UPS or generator power and confirm its power telemetry.", "Keep encrypted local submission buffers and synchronize when connectivity returns."],
        "No significant incident": ["Continue monitoring heartbeat, network, server, database, and submission signals."],
    }[root_cause]
    trajectory = [{"sample": 1, "risk": score}]
    centers = []
    for center in CENTERS:
        rows = [item for item in entities if item["center"] == center]
        affected = sum(row["impacted"] for row in rows)
        centers.append({"name": center, "students": len(rows), "affected": affected,
                        "status": "CRITICAL" if affected / max(1, len(rows)) > .25 else "AT_RISK" if affected / max(1, len(rows)) >= .08 else "NORMAL",
                        "latency_ms": round(sum(row["latency"] for row in rows) / max(1, len(rows)), 1)})
    run_id = str(uuid.uuid4())
    generated_at = datetime.now(timezone.utc).isoformat()
    explanation = (f"{root_cause} is the strongest match across the observed signals. "
                  f"Risk is {score}/100 ({status.lower()}) and the recent trajectory is {trend.lower()}. "
                  f"{impacted} of {ENTITY_COUNT} simulated students are affected. Evidence: " + "; ".join(cause_evidence))
    downtime = profile["downtime"] if impacted else 0
    action_by_cause = {
        "Network degradation": "ACTIVATE_CONTINUITY",
        "Server overload": "ACTIVATE_CONTINUITY",
        "Database slowdown": "ACTIVATE_CONTINUITY",
        "Authentication surge": "AUTH_RECOVERY",
        "Power loss at an exam center": "ACTIVATE_CONTINUITY",
        "No significant incident": "MONITOR",
    }
    return {
        "id": run_id, "generatedAt": generated_at, "mode": "SIMULATED", "scenario": scenario,
        "entityCount": ENTITY_COUNT, "metrics": metrics,
        "anomaly": {"detected": score >= 45, "status": status, "signals": parts, "movingAverage": moving_average, "trend": trend},
        "risk": {"score": score, "currentScore": current_score, "status": status, "trajectory": trajectory},
        "rootCause": {"classification": root_cause, "confidence": round(max(e[1] for e in evidence) if evidence else 0), "evidence": cause_evidence},
        "explanation": explanation, "recommendations": recommendations,
        "prediction": {
            "riskScore": score,
            "status": "CRITICAL" if score >= 75 else "AT_RISK" if score >= 45 else "NORMAL",
            "rootCause": root_cause,
            "confidence": round(max(e[1] for e in evidence) / 100, 2) if evidence else 0,
            "evidence": cause_evidence,
            "recommendedAction": action_by_cause[root_cause],
        },
        "centers": centers,
        "forensics": {"affectedStudents": impacted, "totalStudents": ENTITY_COUNT,
                      "estimatedDowntimeMinutes": downtime, "estimatedRecoveryMinutes": profile["recovery"] if impacted else 0,
                      "successfulRecoveries": impacted, "recoveryRatePct": 100 if impacted else 100,
                      "rootCause": root_cause, "recommendations": recommendations,
                      "note": "Impact and timing are estimates from the simulation profile, not measured production records."},
    }
