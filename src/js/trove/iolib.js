({
  requires: [ ],
  provides: {
    shorthands: { },
    values: {
      // Intentional design decision to not expose as a pure function. This is different from Haskell.
      //
      // ```haskell
      // getChar :: IO Char
      // ```
      //
      // ref: https://www.haskell.org/tutorial/io.html
      "prompt": ["arrow", ["String"], "String"]
    },
    aliases: { },
    datatypes: { }
  },
  nativeRequires: ["readline"],
  theModule: function(RUNTIME, NAMESPACE, uri, readline) {
    function Input() {
        return RUNTIME.pauseStack(function(restarter) {
          const rl = readline.createInterface({ input: RUNTIME.stdin });
          
          // input does not need to display anything
          new Promise(resolve => rl.question('', input => resolve(input)))
            .then(result => restarter.resume(RUNTIME.makeString(result)))
            .catch(error => {
              // TODO: we should probably NOT fail this hard
              restarter.error(RUNTIME.makeString(error));
            })
            .finally(_ => rl.close())
        })
    };

    function Prompt(msg) {
      RUNTIME.stdout(msg);
      return Input();
    };

    var vals = {
        "input": RUNTIME.makeFunction(function() {
          RUNTIME.ffi.checkArity(0, arguments, "input", false);
          return Input();
        }, "input"),
        "prompt": RUNTIME.makeFunction(function(msg) {
          RUNTIME.ffi.checkArity(1, arguments, "prompt", false);
          RUNTIME.checkString(msg);
          return Prompt(msg);
        }, "prompt")
    };

    return RUNTIME.makeModuleReturn(vals, {});
  }
})

