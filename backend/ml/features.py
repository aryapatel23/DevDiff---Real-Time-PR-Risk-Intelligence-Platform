import re

CRITICAL_FILE_RE = re.compile(
    r'(auth|login|password|payment|billing|token|secret|session|admin|db|database)',
    re.IGNORECASE
)
USER_INPUT_RE = re.compile(r'\b(req\.(body|params|query|headers)|request\.(body|params|query))\b')
NULL_GUARD_RE = re.compile(r'\b(if\s*\(|&&|\?\?|typeof\s+\w+\s*!==?\s*[\'\"]undefined|!==\s*null|try\s*\{|\.hasOwnProperty)\b')
TEST_FILE_RE = re.compile(r'(test|spec|mock|fixture|__tests__|\.test\.|\.spec\.)', re.IGNORECASE)

def extract_features(line_content, filename, rule_name, rule_base_weight,
                     author_pattern_count=0, surrounding_lines=None):
    surrounding = surrounding_lines or []
    ctx = ' '.join(surrounding)
    c = line_content

    is_critical_file = int(bool(CRITICAL_FILE_RE.search(filename)))
    is_test_file = int(bool(TEST_FILE_RE.search(filename)))
    has_user_input = int(bool(USER_INPUT_RE.search(c)))
    has_template_lit = int('${' in c)
    has_null_guard = int(bool(NULL_GUARD_RE.search(ctx)))

    length = len(c.strip())
    line_len_bucket = 0 if length < 40 else (1 if length < 100 else 2)

    dot_depth = min(c.count('.'), 10)
    paren_depth = min(c.count('('), 8)
    is_async = int(bool(re.search(r'\b(async|await|Promise|\.then\(|\.catch\()\b', c)))
    is_cond = int(bool(re.match(r'\s*(if|else|switch|case|\?)', c)))
    has_concat = int(bool(re.search(r'["\'][^"\']*["\'\s]*\+|\+\s*["\']', c)))
    has_eval = int(bool(re.search(r'\b(eval\(|exec\(|new Function\()\b', c)))
    has_weak = int(bool(re.search(r'\b(md5\(|sha1\(|Math\.random\(\))\b', c)) and is_critical_file)

    return [
        is_critical_file,
        is_test_file,
        has_user_input,
        has_template_lit,
        has_null_guard,
        line_len_bucket,
        dot_depth,
        paren_depth,
        is_async,
        is_cond,
        has_concat,
        float(rule_base_weight),
        min(author_pattern_count, 20),
        has_eval,
        has_weak
    ]
