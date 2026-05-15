module.exports = {
  name: 'prototype-pollution',
  severity: 'critical',
  check(content, filename) {
    if (!/\.(js|ts|jsx|tsx)$/.test(filename)) return null;
    const protoAssign     = /\.__proto__\s*=|\["__proto__"\]\s*=/.test(content);
    const constructorProp = /\.constructor\s*\[\s*['"]prototype['"]\s*\]/.test(content);
    const objectAssignAll = /Object\.assign\s*\(\s*\w+\s*,\s*req\.(body|params|query)/.test(content);

    if (protoAssign || constructorProp || objectAssignAll) {
      return {
        message:  'Prototype pollution risk — user-controlled data assigned to object prototype or via Object.assign',
        fix_hint: 'Whitelist allowed keys before merging user input. Avoid Object.assign(target, req.body)',
      };
    }
    return null;
  },
};
