#!/usr/bin/env python3
"""
Test fixture: Python grader that exits with non-zero code.
"""

import sys

sys.stderr.write("Intentional failure")
sys.exit(1)
