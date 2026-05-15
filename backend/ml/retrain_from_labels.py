"""
Retrain DevDiff model from manually-labeled findings.

Input CSV columns (required):
- feature_0 ... feature_8
- label (0 or 1)

Optional env vars:
- LABEL_CSV_PATH (default: ../data/labeling_candidates.csv)
- MODEL_OUTPUT_PATH (default: ./model.pkl)
"""
import csv
import os
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LABEL_CSV = os.path.join(BASE_DIR, '..', 'data', 'labeling_candidates.csv')
DEFAULT_OUTPUT_MODEL = os.path.join(BASE_DIR, 'model.pkl')


def _parse_label(value):
    s = str(value).strip()
    if s in ('0', '1'):
        return int(s)
    return None


def load_labeled_rows(csv_path):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'Labeled CSV not found: {csv_path}')

    X = []
    y = []

    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = _parse_label(row.get('label', ''))
            if label is None:
                continue

            features = []
            ok = True
            for i in range(9):
                key = f'feature_{i}'
                if key not in row:
                    ok = False
                    break
                try:
                    features.append(float(row[key]))
                except (TypeError, ValueError):
                    ok = False
                    break

            if not ok:
                continue

            X.append(features)
            y.append(label)

    if not X:
        raise ValueError('No labeled rows found. Fill the label column with 0/1 values first.')

    return np.array(X, dtype=float), np.array(y, dtype=int)


def train_supervised_model(X, y):
    if len(np.unique(y)) < 2:
        raise ValueError('Need both label classes (0 and 1). Add at least one row of each class.')

    test_size = 0.2 if len(y) >= 25 else 0.34

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)),
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1': float(f1_score(y_test, y_pred, zero_division=0)),
        'train_samples': int(len(y_train)),
        'test_samples': int(len(y_test)),
        'positive_rate_train': float(np.mean(y_train)),
        'positive_rate_test': float(np.mean(y_test)),
    }

    bundle = {
        'type': 'supervised_logreg_v1',
        'feature_count': 9,
        'trained_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'metrics': metrics,
        'model': pipeline,
    }

    return bundle, metrics


def save_model(bundle, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if os.path.exists(output_path):
        backup = output_path + '.bak'
        try:
            os.replace(output_path, backup)
            print(f'[DevDiff] Existing model backed up to {backup}')
        except OSError:
            pass

    joblib.dump(bundle, output_path)


def main():
    csv_path = os.environ.get('LABEL_CSV_PATH', DEFAULT_LABEL_CSV)
    output_path = os.environ.get('MODEL_OUTPUT_PATH', DEFAULT_OUTPUT_MODEL)

    print(f'[DevDiff] Loading labeled data: {csv_path}')
    X, y = load_labeled_rows(csv_path)
    print(f'[DevDiff] Labeled rows used: {len(y)}')

    bundle, metrics = train_supervised_model(X, y)

    print('[DevDiff] Validation metrics:')
    print(f"  accuracy : {metrics['accuracy']:.4f}")
    print(f"  precision: {metrics['precision']:.4f}")
    print(f"  recall   : {metrics['recall']:.4f}")
    print(f"  f1       : {metrics['f1']:.4f}")

    save_model(bundle, output_path)
    print(f'[DevDiff] Real-data model saved to {output_path}')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'[DevDiff ERROR] {exc}', file=sys.stderr)
        sys.exit(1)
