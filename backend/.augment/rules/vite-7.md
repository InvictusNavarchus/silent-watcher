---
type: "manual"
---

# Vite 7.0 Complete Changelog and Migration Guide

## Release Information
- **Release Date**: June 24, 2025
- **Previous Version**: Vite 6.x
- **Status**: Stable Release

## Overview

Vite 7.0 represents a significant evolution in the frontend build tool ecosystem, introducing major performance improvements, modernized browser targets, and experimental Rust-based bundling capabilities. This release focuses on preparing Vite for the future while maintaining stability and backward compatibility.

## Major Breaking Changes

### 1. Node.js Version Requirements

**Breaking Change**: Node.js 18 support dropped

- **Minimum Requirements**: Node.js 20.19+ or 22.12+
- **Rationale**: Node.js 18 reached End-of-Life (EOL) in April 2025
- **Impact**: Applications running on Node.js 18 must upgrade before migrating to Vite 7
- **Benefits**: 
  - Native `require(esm)` support without flags
  - Enables ESM-only distribution without preventing CJS compatibility
  - Better performance and security from newer Node.js versions

### 2. Default Browser Target Changes

**Breaking Change**: Browser target updated to "Baseline Widely Available"

**Previous Default (Vite 6)**: `'modules'`
**New Default (Vite 7)**: `'baseline-widely-available'`

**Updated Browser Versions**:
- Chrome: 87 → 107
- Edge: 88 → 107  
- Firefox: 78 → 104
- Safari: 14.0 → 16.0

**What This Means**:
- All supported browsers were released before November 2022
- Features are "widely available" (stable across browsers for 30+ months)
- Predictable browser target updates aligned with web standards baseline
- More modern JavaScript features can be used by default

### 3. Sass Legacy API Removal

**Breaking Change**: Legacy Sass API completely removed

- **Removed Options**: 
  - `css.preprocessorOptions.sass.api`
  - `css.preprocessorOptions.scss.api`
- **Migration**: Remove these options from your configuration
- **Background**: Sass deprecated legacy API in Dart Sass 1.45.0, removing in v2.0
- **Impact**: Projects using legacy Sass API must migrate to modern API

## Removed Deprecated Features

### 1. splitVendorChunkPlugin

**Status**: Removed (deprecated in v5.2.7)

- **Original Purpose**: Ease migration to Vite v2.9
- **Migration**: Use `build.rollupOptions.output.manualChunks` for custom chunking
- **Impact**: Minimal - most projects should not be affected

### 2. transformIndexHtml Hook Changes

**Status**: Removed (deprecated in v4.0.0)

- **Removed**: Hook-level `enforce`/`transform` properties
- **Migration**: 
  - Use `order` instead of `enforce`
  - Use `handler` instead of `transform`
- **Rationale**: Alignment with Rollup's object hook interface

### 3. Advanced API Removals

**Removed Properties**:
- `ModuleRunnerOptions.root`
- `ViteDevServer._importGlobMap`
- `ResolvePluginOptions.isFromTsImporter`
- `ResolvePluginOptions.getDepsOptimizer`
- `ResolvePluginOptions.shouldExternalize`
- `ResolvePluginOptions.ssrConfig`
- `legacy.proxySsrExternalModules`
- `HotBroadcaster` related types: `HMRBroadcaster`, `HMRBroadcasterClient`, `ServerHMRChannel`, `HMRChannel`

**Impact**: These changes affect very few users, primarily advanced plugin authors

## New Features and Improvements

### 1. Rolldown Integration (Experimental)

**Major Feature**: Rust-powered bundler integration

**What is Rolldown**:
- High-performance JavaScript bundler written in Rust
- Drop-in replacement for Rollup
- 10-30x faster than Rollup, comparable to esbuild performance
- Better WASM compilation performance than esbuild

**How to Use**:
```json
{
  "dependencies": {
    "vite": "npm:rolldown-vite@latest"
  }
}
```

**Performance Benefits**:
- GitLab: 2.5 min → 40 sec (~3.75× faster)
- Excalidraw: 22.9 sec → 1.4 sec (~16× faster)
- PLAID: 1 min 20 sec → 5 sec (~16× faster)
- Appwrite: 12+ min → 3 min (~4× faster)

**Features**:
- Speed: Rust-based performance
- Compatibility: Works with existing Rollup plugins
- Additional Features: Advanced chunk splitting, built-in HMR, Module Federation

**Future**: Will become the default bundler in future Vite versions

### 2. Environment API Enhancements

**Status**: Experimental (continued from Vite 6)

**New in Vite 7**: `buildApp` hook for plugins
- Allows plugins to coordinate building of environments
- Better support for multi-environment applications
- Enhanced framework integration capabilities

**Environments Supported**:
- Client (browser)
- SSR (server-side rendering)
- Edge (edge computing environments)
- Custom environments via API

### 3. Middleware Improvements

**New Features**:
- Middlewares applied before `configureServer` hook
- Middlewares applied before `configurePreviewServer` hook
- Better control over request handling pipeline
- Improved CORS and header management

### 4. Developer Experience Improvements

**Plugin Enhancements**:
- Access to Vite version via `this.meta.viteVersion` in plugins
- Better version-aware plugin development
- Improved compatibility checking

**Performance Optimizations**:
- Faster startup times
- Improved hot module replacement (HMR)
- Better caching strategies
- Reduced memory usage

## Vitest Compatibility

**Supported Version**: Vitest 3.2+
- Full compatibility with Vite 7.0
- Enhanced testing performance
- Better integration with new features

## Ecosystem Updates

### ViteConf 2025
- First in-person conference in Amsterdam (October 9-10, 2025)
- Partnership with JSWorld, Bolt, VoidZero, and Vite Core Team

### Vite DevTools
- Partnership between VoidZero and NuxtLabs
- Anthony Fu leading development
- Deeper debugging and analysis capabilities
- Support for all Vite-based projects and frameworks

### VoidZero Collaboration
- Continued development of unified JavaScript toolchain
- Rolldown as cornerstone of future Vite architecture
- Open source commitment with performance focus

## Migration Guide

### Prerequisites

1. **Node.js Upgrade**:
   ```bash
   node --version  # Should be 20.19+ or 22.12+
   ```

2. **Dependency Check**:
   ```bash
   npm outdated | grep vite
   npm audit
   ```

### Step-by-Step Migration

1. **Update Vite**:
   ```bash
   npm install vite@^7.0.0
   ```

2. **Remove Deprecated Configuration**:
   ```javascript
   // Remove these from vite.config.js
   export default {
     css: {
       preprocessorOptions: {
         sass: {
           api: 'legacy' // ❌ Remove this
         },
         scss: {
           api: 'legacy' // ❌ Remove this
         }
       }
     }
   }
   ```

3. **Update transformIndexHtml Hooks** (if using):
   ```javascript
   // Before
   export default {
     transformIndexHtml: {
       enforce: 'pre',
       transform(html, context) {
         // transformation logic
       }
     }
   }
   
   // After
   export default {
     transformIndexHtml: {
       order: 'pre',
       handler(html, context) {
         // transformation logic
       }
     }
   }
   ```

4. **Replace splitVendorChunkPlugin** (if using):
   ```javascript
   // Before
   import { splitVendorChunkPlugin } from 'vite'
   
   export default {
     plugins: [splitVendorChunkPlugin()]
   }
   
   // After
   export default {
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             utils: ['lodash', 'axios']
           }
         }
       }
     }
   }
   ```

5. **Test Browser Compatibility**:
   - Verify your target browsers support the new baseline
   - Update browser support documentation
   - Test in minimum supported browser versions

### Optional: Try Rolldown

1. **Install rolldown-vite**:
   ```bash
   npm install rolldown-vite@latest
   ```

2. **Update package.json**:
   ```json
   {
     "dependencies": {
       "vite": "npm:rolldown-vite@latest"
     }
   }
   ```

3. **Test Performance**:
   - Measure build times before/after
   - Verify all functionality works
   - Report issues to the Rolldown team

## Breaking Changes Impact Assessment

### Low Impact (Most Projects)
- Sass legacy API removal (if using modern API)
- splitVendorChunkPlugin removal (if not using)
- Advanced API removals (internal use only)

### Medium Impact
- Node.js version requirement (requires infrastructure update)
- Browser target changes (may affect very old browser support)

### High Impact
- Applications still using Node.js 18
- Projects heavily dependent on deprecated APIs
- Custom plugins using removed internal APIs

## Performance Improvements

### Build Performance
- Faster dependency resolution
- Improved caching mechanisms
- Better parallel processing
- Reduced memory footprint

### Development Performance
- Faster server startup
- Improved HMR performance
- Better source map generation
- Enhanced debugging capabilities

### Bundle Performance
- Smaller output bundles (with modern targets)
- Better tree-shaking
- Improved code splitting
- Enhanced compression

## TypeScript Support

- Full TypeScript support maintained
- Updated type definitions
- Better IntelliSense integration
- Improved error reporting

## Plugin Ecosystem

### Compatibility
- Most Vite 6 plugins compatible
- Plugin API remains stable
- New plugin capabilities added
- Better plugin development tools

### New Plugin Features
- Environment-aware plugins
- Better lifecycle hooks
- Enhanced configuration options
- Improved error handling

## Testing Your Migration

### Checklist
- [ ] Node.js version upgraded (20.19+ or 22.12+)
- [ ] All deprecated configuration removed
- [ ] Build succeeds without errors
- [ ] Development server starts correctly
- [ ] Hot reload functions properly
- [ ] Production build works
- [ ] Browser compatibility tested
- [ ] Performance benchmarks meet expectations

### Common Issues and Solutions

1. **Node.js Version Error**:
   ```
   Error: Vite requires Node.js 20.19+ or 22.12+
   ```
   **Solution**: Upgrade Node.js to supported version

2. **Sass API Error**:
   ```
   Error: Unknown option 'api'
   ```
   **Solution**: Remove `api` option from Sass configuration

3. **Plugin Compatibility**:
   ```
   Error: Plugin uses deprecated API
   ```
   **Solution**: Update plugin to latest version or find alternative

4. **Browser Support Issues**:
   **Solution**: Update `build.target` if you need to support older browsers:
   ```javascript
   export default {
     build: {
       target: 'es2015' // or your specific target
     }
   }
   ```

## Future Roadmap

### Short-term (Vite 7.x)
- Rolldown stability improvements
- Performance optimizations
- Bug fixes and minor features

### Medium-term (Vite 8.x)
- Rolldown as default bundler
- Further performance improvements
- Enhanced developer tools

### Long-term
- Full Rust-based toolchain integration
- Advanced optimization features
- Extended ecosystem support

## Resources

- [Official Migration Guide](https://vite.dev/guide/migration)
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7)
- [Rolldown Documentation](https://rolldown.rs/)
- [GitHub Changelog](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md)
- [ViteConf 2025](https://viteconf.org/)

## Community and Support

- [Discord Community](https://chat.vitejs.dev/)
- [GitHub Discussions](https://github.com/vitejs/vite/discussions)
- [Reddit Community](https://reddit.com/r/vitejs)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/vite)

---

**Note**: This changelog represents a comprehensive overview of Vite 7.0 changes. For the most current information, always refer to the official Vite documentation and release notes.