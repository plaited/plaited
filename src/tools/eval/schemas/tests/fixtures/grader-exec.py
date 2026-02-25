#!/usr/bin/env python3
"""
Test fixture: Python grader script using stdin/stdout JSON protocol.
"""

import json
import sys

def main():
    data = json.load(sys.stdin)

    output = data.get("output", "").lower()
    hint = (data.get("hint") or "").lower()

    if hint:
        pass_result = hint in output
    else:
        pass_result = True

    result = {
        "pass": pass_result,
        "score": 1.0 if pass_result else 0.0,
        "reasoning": "Contains expected" if pass_result else "Missing expected"
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
