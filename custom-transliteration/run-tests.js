// Runs tests.js, which calls `transliterate` as a global and reports through
// console.assert.  `node custom-transliteration/run-tests.js`
import { transliterate } from "./transliterate.js";

globalThis.transliterate = transliterate;

let total = 0;
const failed = [];
const assert = console.assert.bind(console);
console.assert = (ok, ...rest) => {
  total += 1;
  if (!ok) {
    failed.push(total);
    assert(ok, ...rest);
  }
};

await import("./tests.js");

console.log(`${total - failed.length}/${total} passed`);
if (failed.length) {
  console.error(`failing assertion(s) in tests.js: #${failed.join(", #")}`);
  process.exitCode = 1;
}
