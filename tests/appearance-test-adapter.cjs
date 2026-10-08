// Existing isolated component harnesses use the real presentation adapter with
// their React Native color scheme; native preference persistence is tested separately.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
exports.wrap = base => {
  const modules = new Map();
  const scheme = () => { try { return base('react-native').useColorScheme?.() ?? 'light'; } catch { return 'light'; } };
  const appearance = {
    useAppColorScheme: scheme, presentationInterfaceStyle: () => scheme() === 'dark' ? 'dark' : 'light',
    useAppearancePreference: () => ({ ready: true, preference: 'system' }),
    appearanceStore: { restore: async () => {}, set: async () => {} },
  };
  function load(name) {
    if (name === '@/theme/appearance' || name === './appearance') return appearance;
    if (name === '@/theme/palette' || name === './palette' || name === '@/theme/presentation') {
      const file = name.includes('palette') ? 'palette' : 'presentation';
      if (!modules.has(file)) {
        const module = { exports: {} };
        const code = ts.transpileModule(fs.readFileSync('src/theme/' + file + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        vm.runInNewContext(code, { module, exports: module.exports, require: dep => {
          if (dep === 'react') { let nativeReact = {}; try { nativeReact = base(dep); } catch {} return { ...nativeReact, useMemo: nativeReact?.useMemo ?? (fn => fn()) }; }
          if (dep === 'react-native') { const native = base(dep); return { ...native, StyleSheet: { ...native?.StyleSheet, flatten: native?.StyleSheet?.flatten ?? (style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean))) } }; }
          return load(dep);
        } });
        modules.set(file, module.exports);
      }
      return modules.get(file);
    }
    return base(name);
  }
  return load;
};
