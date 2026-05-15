"""
DevDiff ML Scorer - called from Node via child_process.
Reads 15-feature JSON from stdin, writes score JSON to stdout.

Node sends:  {"features": [...15 floats...], "_id": 42}
Returns:     {"score": 87.3, "severity": "critical", "_id": 42}
"""
import sys
import json
import os
import numpy as np
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
try:
    pipeline = joblib.load(MODEL_PATH)
except FileNotFoundError:
    sys.stderr.write('[devdiff-ml] model.pkl not found. Run: python3 ml/train.py\n')
    sys.exit(1)


def severity(prob):
    if prob >= 0.75:
        return 'critical'
    if prob >= 0.45:
        return 'warning'
    return 'info'


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    try:
        data = json.loads(raw)
        features = np.array([data['features']], dtype=float)
        prob = float(pipeline.predict_proba(features)[0][1])
        score = round(prob * 100, 1)
        print(json.dumps({'score': score, 'severity': severity(prob), '_id': data.get('_id', 0)}), flush=True)
    except Exception as e:
        print(json.dumps({'score': 50.0, 'severity': 'warning', '_id': 0, 'error': str(e)}), flush=True)
