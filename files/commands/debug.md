Systematic debugging. Never guess — diagnose. Follow these steps in order; do not jump to a fix before the root cause is understood.

## Steps

1. **Capture the full failure.** Exact error message, full stack trace, the command run, and what changed recently (`git diff`, `git log`, recent edits). Don't paraphrase the error — read it literally.

2. **Read the error.** The answer is often right there. Read the whole message, including the lines you'd usually skip. Note the exact file, line, and value mentioned.

3. **Reproduce reliably.** Find the smallest, most consistent way to trigger the failure. If it's intermittent, identify what varies between pass and fail (state, timing, env, data).

4. **Trace the data flow.** Work backwards from the failure point. Where did the bad value come from? Follow it up the call chain until you find where it first went wrong — that's the cause, not the crash site.

5. **Form a hypothesis.** State a specific, testable cause: "X is null because Y returns undefined when Z." Predict what you'd see if it's true.

6. **Test the hypothesis.** Add a log, a breakpoint, or a tiny experiment that confirms or refutes it. If refuted, return to step 4 — don't patch around it.

7. **Fix with understanding.** Only now change code, and only the root cause. You must be able to explain *why* the fix works. "I don't know why this works" is not acceptable.

8. **Verify.** Reproduce the original trigger and confirm it's resolved. Run the relevant tests. Check you introduced no regressions.

## Red flags (you're guessing, not debugging)
- Making changes with no clear reason
- Rapid successive attempts ("try this... no, try this...")
- A fix you can't explain
- Reverting versions hoping it helps
- Suppressing the error (`try/catch` swallow, `@ts-ignore`, `eslint-disable`) instead of fixing it
