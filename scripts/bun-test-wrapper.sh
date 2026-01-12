#!/bin/bash
# Wrapper for bun test that handles Bun's post-test cleanup crash
# See: https://github.com/oven-sh/bun/issues/23643
#
# Bun 1.3.x has a known bug where the test runner crashes during cleanup
# after all tests complete successfully. This wrapper catches that crash
# (exit code 133 = SIGTRAP) and exits cleanly if tests actually passed.
#
# Usage:
#   ./bun-test-wrapper.sh [args...]     # Run bun test with provided args
#   ./bun-test-wrapper.sh               # (No args) Find and run all *.docker.ts files

# Determine test files to run
if [ $# -eq 0 ]; then
  # No arguments: find all *.docker.ts files for Docker integration tests
  docker_tests=$(find ./src -name "*.docker.ts" -type f 2>/dev/null)
  if [ -z "$docker_tests" ]; then
    echo "No *.docker.ts files found in ./src"
    exit 0
  fi
  echo "Found Docker integration tests:"
  echo "$docker_tests" | sed 's/^/  /'
  echo ""
  # Convert newlines to arguments
  set -- $docker_tests
fi

# Create temp file for output
tmpfile=$(mktemp)
trap "rm -f $tmpfile" EXIT

# Run tests with output to both terminal and file
bun test "$@" 2>&1 | tee "$tmpfile"
exit_code=${PIPESTATUS[0]}

# Check if tests passed (look for "X pass" and "0 fail" in output)
if grep -q " pass" "$tmpfile" && grep -q "0 fail" "$tmpfile"; then
  # Tests passed - exit 0 even if Bun crashed during cleanup
  if [ $exit_code -eq 133 ]; then
    echo ""
    echo "Note: Bun crashed during cleanup (known bug), but all tests passed."
    exit 0
  fi
fi

exit $exit_code
