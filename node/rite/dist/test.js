import { assert } from './assert.js';
class TestRunner {
    #testCases = [];
    #completedTests = 0;
    #passedTests = 0;
    #failedTests = 0;
    #allTestsDoneCallback;
    add(testCase) {
        this.#testCases.push(testCase);
    }
    async run(onAllTestsDone) {
        this.#allTestsDoneCallback = onAllTestsDone || (() => { });
        for (const testCase of this.#testCases) {
            const result = await testCase();
            this.#completedTests++;
            if (result) {
                this.#passedTests++;
            }
            else {
                this.#failedTests++;
            }
            if (this.#completedTests === this.#testCases.length) {
                this.#allTestsDoneCallback();
            }
        }
    }
    logResults() {
        console.log(`${this.#passedTests} passed, ${this.#failedTests} failed`);
    }
}
export const testRunner = new TestRunner();
export const test = (name, cb) => {
    testRunner.add(async () => {
        let success = false;
        try {
            await cb(assert);
            success = true;
            const msg = `✔ ${name}`;
            console.log(msg);
        }
        catch (error) {
            const msg = `✘ ${name} \n ${error.stack}`;
            console.error(msg);
        }
        return success;
    });
};
