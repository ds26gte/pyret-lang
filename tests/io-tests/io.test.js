const glob = require('glob');
const fs = require('fs');
const cp = require('child_process');
const assert = require('assert');

const COMPILER_TIMEOUT = 60000; // ms, for each compiler run (including startup)
const RUN_TIMEOUT = 60000; // ms, for each program execution
const COMPILED_CODE_PATH = "compiled.jarr";
const SUCCESS_EXIT_CODE = 0;
const EMPTY_MESSAGE = "";

const parse_file_for_expected_std = (f) => {
  let stdioExpected = EMPTY_MESSAGE;
  let stdInToInject = EMPTY_MESSAGE;
  let stderrExpected = EMPTY_MESSAGE;

  String(fs.readFileSync(f))
    .split("\n")
    .forEach((line) => {
      // NOTE: we expect only one instance of each to be defined. However, if more
      // than one is defined, we will use the last one.
      
      // stdin
      if (line.startsWith("###<")) {
        stdInToInject = line.slice(line.indexOf(" ")).trim() + "\n";
      }
      
      // stdout
      if(line.startsWith("###>")) {
        stdioExpected = line.slice(line.indexOf(" ")).trim();
      }

      // stderr
      if(line.startsWith("###!")) {
        stderrExpected = line.slice(line.indexOf(" ")).trim();
      }
  });

  return {
    stdioExpected: stdioExpected,
    stdInToInject: stdInToInject,
    stderrExpected: stderrExpected
  }
}

const try_delete_compiled_file = () => {
  try { fs.unlinkSync(COMPILED_CODE_PATH); } 
  catch {}
}

describe("IO Tests", () => {
  glob.sync(`tests/io-tests/tests/*.arr`, {}).forEach(f => {
    beforeEach(() => try_delete_compiled_file());
    afterEach(() => try_delete_compiled_file());

    describe("Testing " + f, () => {
      const {stdioExpected, stdInToInject, stderrExpected} = parse_file_for_expected_std(f);

      test(`it should return io that is expected: ${stdioExpected}`, () => {  
        const compileProcess = cp.spawnSync(
          "node",
          [
            // according to README.md in root, phaseA is recommended for testing
            "build/phaseA/pyret.jarr",
            "--build-runnable", f, 
            "--outfile", COMPILED_CODE_PATH, 
            "--builtin-js-dir", "src/js/trove", 
            "--builtin-arr-dir","src/arr/trove", 
            "--require-config","src/scripts/standalone-configA.json",
            "--compiled-dir", "tests/compiled/"
          ],
          {stdio: "pipe", stderr: "pipe", timeout: COMPILER_TIMEOUT});
         
        // at this time, we always expect compilation to succeed
        expect(compileProcess.status).toEqual(SUCCESS_EXIT_CODE);
        expect(compileProcess.stderr.toString()).toEqual(EMPTY_MESSAGE);

        const runProcess = cp.spawnSync(
          'node', 
          [COMPILED_CODE_PATH], 
          {input: stdInToInject, stdio: 'pipe', stderr: "pipe", timeout: RUN_TIMEOUT});

        if (stderrExpected !== EMPTY_MESSAGE) {
          expect(runProcess.status).not.toEqual(SUCCESS_EXIT_CODE);
          expect(runProcess.stderr.toString()).toMatch(new RegExp(stderrExpected));
        } 
        else {
          expect(runProcess.status).toEqual(SUCCESS_EXIT_CODE);
          expect(runProcess.stdout.toString()).toMatch(new RegExp(stdioExpected));
        }
      });
    });
  });
});