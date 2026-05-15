# AI & Machine Learning Documentation

## Overview

DevDiff employs a multi-layered AI approach combining:
1. **Static Security Rules** - Fast pattern-based detection
2. **Random Forest ML Model** - Confidence scoring
3. **LLM-based Logic Review** - Deep code analysis (optional)

---

## Layer 1: Security Rules (Fast Pass)

### Purpose
Provide quick, deterministic identification of common security vulnerabilities.

### Implementation
- 20 individual rule modules in `/backend/rules/`
- Each rule is a function that analyzes a single line + context
- Returns: `{ rule_name, message, fix_hint, severity, isDeterministic }`

### Deterministic Rules (Always Reported)
These are high-confidence patterns that bypass ML scoring:
- `secret-leak` - Hardcoded API keys, tokens, passwords
- `eval-usage` - Dynamic code execution
- `sql-injection` - SQL string concatenation
- `prototype-pollution` - Unsafe object operations
- `jwt-no-expiry` - Missing token expiration
- `sensitive-data-log` - Passwords in logs

### ML-Scored Rules
These pass through the ML model for confidence assessment:
- `null-deref`, `xss-innerhtml`, `path-traversal`, etc.

---

## Layer 2: Random Forest ML Model

### Purpose
Add intelligent confidence scoring to rule findings, reducing false positives while catching nuanced vulnerabilities.

### Training Data

#### Synthetic Dataset Generation
The model is trained on a synthetic dataset inspired by CVE patterns:

| Category | Samples | Pattern |
|----------|---------|---------|
| SQL Injection | 280 | User input in SQL context |
| XSS | 200 | innerHTML assignments |
| Path Traversal | 200 | File path from user input |
| Eval Usage | 150 | eval/new Function calls |
| Weak Crypto | 140 | MD5/SHA1 usage |
| Hardcoded Secrets | 150 | API keys, tokens |
| Null Deref | 140 | Missing null checks |
| ReDoS | 140 | Complex regex |
| Prototype Pollution | 200 | Object merge patterns |
| ... | ... | ... |
| Safe samples | 2500 | Normal code patterns |

**Total: ~4200 samples with 15 engineered features**

### Feature Engineering

Each rule hit produces a 15-dimensional feature vector:

| Feature | Type | Description |
|---------|------|-------------|
| 1. is_critical_file | Binary | Auth/payment/token file |
| 2. is_test_file | Binary | Test file detection |
| 3. has_user_input | Binary | req.body/query presence |
| 4. has_template_literal | Binary | Template string usage |
| 5. has_null_guard | Binary | Null check nearby |
| 6. line_length_bucket | Numeric | 1-5 buckets |
| 7. dot_depth | Numeric | Object chain depth |
| 8. paren_depth | Numeric | Parentheses nesting |
| 9. async_signal | Binary | Async/await presence |
| 10. conditional_signal | Binary | If/ternary presence |
| 11. concat_signal | Binary | String concat detected |
| 12. rule_base_weight | Numeric | Rule severity weight |
| 13. author_history_count | Numeric | Author pattern frequency |
| 14. eval_like_signal | Binary | eval-like patterns |
| 15. weak_crypto_in_critical | Binary | Crypto in critical files |

### Model Architecture

```python
Pipeline([
    ('scaler', StandardScaler()),
    ('model', RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=4,
        class_weight='balanced',
        random_state=42
    ))
])
```

### Cross-Validation Results
- 5-fold cross-validation
- **Mean F1 Score: ~0.92**
- Per-fold: [0.89, 0.93, 0.91, 0.94, 0.92]

### Prediction Examples

| Input Pattern | Expected Score | Actual Score |
|--------------|---------------|--------------|
| SQL injection in auth.js | > 0.75 | 0.82 |
| Safe guarded code | < 0.25 | 0.18 |
| eval() in critical file | > 0.80 | 0.91 |

### Runtime Integration

The ML Bridge (`mlBridge.js`) handles:
1. Process spawning (finds Python: py, python, python3)
2. JSON IPC via stdin/stdout
3. Timeout handling (8s default)
4. Fallback on failure (score: 50, severity: warning)
5. Process restart on crash

```javascript
// Bridge Usage
const result = await scoreFeatures(features);
// Returns: { score: 0-100, severity: 'critical'|'warning'|'info' }
```

---

## Layer 3: LLM Logic Review (Groq)

### Purpose
Perform deep logic-level analysis that static rules and ML cannot catch.

### When Used
- `ENABLE_LOGIC_REVIEW=true`
- `GROQ_API_KEY` is set
- After all rule-based findings

### What It Analyzes
- Assignment in conditions (`if (x = foo())`)
- Off-by-one errors
- Missing return statements
- Dead code paths
- Race condition patterns
- Control flow issues
- Logic bugs invisible to pattern matching

### What It Skips
- Already covered by rules: SQLi, XSS, secret leak, eval
- Syntax errors (handled by parser)
- Style issues (not security-relevant)

### Chunk-Based Processing

Code is split into logical chunks:
```javascript
// Each chunk includes:
{
  filename: "src/utils.js",
  functionName: "calculateTotal",
  startLine: 45,
  endLine: 78,
  code: "function calculateTotal(items) {...}"
}
```

### Groq Prompt Structure
```
Analyze this code for logic bugs.
Focus on: assignment-in-condition, off-by-one,
control flow, race conditions, edge cases.
Return: severity, confidence, message, fix_suggestion
```

### WebSocket Events
- `logic_review_start` - Review begins
- `logic_finding` - Individual findings (multiple)
- `logic_review_complete` - Review done

---

## Confidence Scoring Algorithm

### Final Confidence Formula

```
final_confidence = min(100, ml_score * rule_weight)
```

Where:
- `ml_score`: ML model probability (0-100)
- `rule_weight`: Configurable per-author weight (default: 1.0)

### Threshold Tuning

Per-developer adaptive thresholds:
```javascript
baseThreshold = rule_thresholds[rule_name] ?? 65
if (author_pattern_count >= 3) {
  escalatedThreshold = max(40, baseThreshold - 10)
}
```

### Severity Mapping
- **Critical**: confidence >= 85
- **Warning**: confidence >= 50 and < 85
- **Info**: confidence < 50

---

## Feedback Loop & Learning

### False Positive Handling
Users can mark findings as false positives:
- Level 1: Change severity to "info"
- Level 2: Suppress entirely

### Pattern Tracking
When finding is NOT marked as FP:
```javascript
upsertPattern(projectId, author, ruleName)
// Increments count in developer_patterns table
```

### Per-Author Adaptation
- Rule weights recalculated after each PR
- Thresholds adjusted based on history
- Pattern frequency affects escalation

### Future: Label-Based Retraining
```bash
npm run prepare:labels     # Extract review candidates
npm run prepare:labels:priority  # Prioritize uncertain
npm run train:real         # Retrain with real labels
```

---

## Risk Score Calculation

### Formula
```
risk_score = min(100, critical_count * 12 + warning_count * 4)
```

### Interpretation
| Score | Risk Level |
|-------|------------|
| 0-20 | Low |
| 21-40 | Medium |
| 41-60 | Elevated |
| 61-80 | High |
| 81-100 | Critical |

---

## Model Maintenance

### Re-training Triggers
1. Performance degradation detected
2. New rule types added
3. Labeled data accumulates

### Model Versioning
- File: `backend/ml/model.pkl`
- Backup: Keep previous versions
- Rollback: Revert to earlier .pkl

### Monitoring
- Track fallback rate (ML unavailable)
- Log prediction confidence distributions
- Alert on sudden false positive spikes

---

## Performance Characteristics

| Component | Latency | Notes |
|-----------|---------|-------|
| Rules (20) | < 5ms | Per line |
| ML Scoring | < 50ms | Per finding |
| LLM Review | 2-5s | Per chunk |
| Total PR | 5-30s | Depends on files |

---

## Future Enhancements

1. **Model Ensemble** - Combine RF with XGBoost
2. **Deep Learning** - BERT for code understanding
3. **Graph Neural Networks** - Call graph analysis
4. **Real-time Fine-tuning** - Online learning
5. **Explainable AI** - SHAP values for confidence