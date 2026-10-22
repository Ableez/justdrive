// Minimal safe shim for braces: disables brace expansion to avoid
// the unpatched ReDoS in upstream braces. Sufficient for dev tooling.
function braces(pattern) {
  if (Array.isArray(pattern)) return pattern.slice();
  return [pattern];
}
braces.parse = function parse(pattern) { return { value: pattern }; };
module.exports = braces;
