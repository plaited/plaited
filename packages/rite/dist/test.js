import { assert, AssertionError } from './assert.js';
class TestRunner {
    #completedTests = 0;
    #failedTests = 0;
    #errors = [];
    #cases = [];
    #timeout = 5000;
    #tests = [];
    updateTimeout(time) {
        this.#timeout = time;
    }
    get timeout() {
        return this.#timeout;
    }
    addCase(test) {
        this.#cases.push(test);
    }
    addResult(result) {
        this.#tests.push(result);
    }
    addError(obj) {
        this.#errors.push(obj);
    }
    async run(name) {
        for (const testCase of this.#cases) {
            try {
                const passed = await testCase();
                this.#completedTests++;
                if (!passed) {
                    this.#failedTests++;
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        if (this.#completedTests === this.#cases.length) {
            const results = {
                passed: !this.#failedTests,
                testResults: {
                    name,
                    suites: [],
                    tests: this.#tests,
                },
                errors: this.#errors,
            };
            return results;
        }
        else {
            throw new AssertionError(`Not all test completed`);
        }
    }
}
window.__rite_test_runner = new TestRunner();
const throwTimeoutError = async () => {
    const timeout = window.__rite_test_runner.timeout;
    await assert.wait(timeout);
    throw new Error(`test takes longer than ${timeout}ms to complete`);
};
export const test = (name, callback) => {
    window.__rite_test_runner.addCase(async () => {
        const startTime = performance.now();
        const result = {
            name,
            passed: true,
            skipped: false,
        };
        try {
            await Promise.race([callback(assert), throwTimeoutError()]);
            const msg = `✓ ${name}`;
            console.log(msg);
        }
        catch (error) {
            const msg = `✗ ${name}`;
            console.log(msg);
            result.passed = false;
            if (error instanceof AssertionError) {
                const obj = JSON.parse(error.message);
                result.error = { name, stack: `${error.stack}`, ...obj };
                window.__rite_test_runner.addError({ name, ...obj });
            }
            else {
                throw new Error(error);
            }
        }
        result.duration = performance.now() - startTime;
        window.__rite_test_runner.addResult(result);
        return result.passed;
    });
};
test.skip = (name, _) => {
    window.__rite_test_runner.addCase(() => {
        const result = {
            name,
            passed: true,
            skipped: true,
        };
        window.__rite_test_runner.addResult(result);
        return true;
    });
};
