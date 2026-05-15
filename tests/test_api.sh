#!/bin/bash
# API tests for DevDiff backend
# Requires: backend running on localhost:4000

BASE="http://localhost:4000"
PASS=0
FAIL=0

assert() {
  if [ "$1" = "true" ]; then
    echo "  PASS: $2"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $2"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "── API Tests ──"

# Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
assert "$([ "$STATUS" = "200" ] && echo true)" "GET /health returns 200"

BODY=$(curl -s "$BASE/health")
assert "$(echo "$BODY" | grep -q '"ok"' && echo true)" "Health body contains ok"

# POST /api/analyze with no body
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" "$BASE/api/analyze")
assert "$([ "$STATUS" = "400" ] && echo true)" "POST /api/analyze with no body returns 400"

# GET /api/scorecard
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/scorecard")
assert "$([ "$STATUS" = "200" ] && echo true)" "GET /api/scorecard returns 200"

# GET /api/heatmap
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/heatmap")
assert "$([ "$STATUS" = "200" ] && echo true)" "GET /api/heatmap returns 200"

# GET /api/history
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/history")
assert "$([ "$STATUS" = "200" ] && echo true)" "GET /api/history returns 200"

# 404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent")
assert "$([ "$STATUS" = "404" ] && echo true)" "GET /nonexistent returns 404"

echo ""
echo "Result: $PASS passed, $FAIL failed"
echo ""
[ "$FAIL" -gt 0 ] && exit 1
exit 0
