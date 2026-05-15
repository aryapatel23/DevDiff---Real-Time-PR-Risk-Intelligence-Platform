"""Run: cd devdiff && python tests/test_ml.py"""
import subprocess, json, sys, os

passed = 0
failed = 0

def assert_test(cond, msg):
    global passed, failed
    if cond:
        print(f'  PASS: {msg}')
        passed += 1
    else:
        print(f'  FAIL: {msg}')
        failed += 1

def score(features):
    p = subprocess.run(
        [sys.executable, 'backend/ml/scorer.py'],
        input=json.dumps({'features': features, '_id': 1}),
        capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    if p.returncode != 0:
        return None
    out = p.stdout.strip()
    if not out:
        return None
    return json.loads(out)

print('\n── ML Scorer Tests ──')

# T1: Critical features → high score
r = score([8., 1., 1., 1., 1., 15., 1., 10., 1.4])
assert_test(r is not None,       'T1a: scorer runs without error')
assert_test(r and r['score'] >= 45, f'T1b: critical features score ≥45, got {r}')

# T2: Safe features → lower score
rs = score([1., 0., 0., 0., 0., 2., 0., 0., 0.2])
rc = score([8., 1., 1., 1., 1., 15., 1., 10., 1.4])
assert_test(rs and rc and rc['score'] > rs['score'], 'T2: critical scores higher than safe')

# T3: All scores 0–100
import random
random.seed(42)
for i in range(5):
    r = score([random.uniform(0,10), random.randint(0,1), random.randint(0,1),
               random.randint(0,1), random.randint(0,1), random.uniform(0,20),
               random.randint(0,1), random.uniform(0,15), random.uniform(0.1,1.5)])
    assert_test(r and 0.0 <= r['score'] <= 100.0, f'T3.{i}: score in range 0–100')

# T4: Severity labels
r_high = score([8., 1., 1., 1., 1., 18., 1., 12., 1.4])
r_low  = score([1., 0., 0., 0., 0.,  2., 0.,  0., 0.1])
assert_test(r_high and r_high['severity'] in ('critical','warning'), 'T4a: high score has severity')
assert_test(r_low  and r_low['severity']  in ('info','warning'),     'T4b: low score severity')

print(f'\nResult: {passed} passed, {failed} failed\n')
sys.exit(0 if failed == 0 else 1)
