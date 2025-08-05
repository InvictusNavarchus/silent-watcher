---
type: "manual"
---

# React 19 Complete Changelog and Migration Guide

## Release Information
- **Release Date**: December 5, 2024 (Stable)
- **Previous Version**: React 18.x
- **Status**: Stable Release
- **Beta Period**: April 2024 - December 2024

## Overview

React 19 represents the first major release in over two years since React 18 (March 2022). This release focuses on developer experience improvements, performance optimizations, and the stabilization of experimental features. Key highlights include stable Server Components, the revolutionary React Compiler, new hooks for better state management, and enhanced form handling capabilities.

## Major New Features

### 1. React Compiler (Automatic Optimization)

**Revolutionary Feature**: Automatic performance optimization

**What It Does**:
- Automatically optimizes React code for performance
- Eliminates need for manual optimization with `useMemo`, `useCallback`, and `memo`
- Handles re-rendering optimization internally
- Converts React code to optimized JavaScript

**Benefits**:
- Up to 2x performance improvement
- Reduced developer cognitive load
- Fewer performance-related bugs
- Automatic memoization without manual intervention

**Current Status**:
- Used in production at Instagram
- Optional in React 19 (will become default in future)
- Requires babel plugin configuration

**Implementation**:
```bash
npm install babel-plugin-react-compiler
```

```javascript
// babel.config.js
module.exports = {
  plugins: ['babel-plugin-react-compiler']
}
```

### 2. React Server Components (Stable)

**Status**: Experimental → Stable

**Key Features**:
- Render components on the server before bundling
- Separate environment from client app or SSR server
- Can run at build time or per-request
- Reduced JavaScript bundle size
- Improved initial page load times
- Better SEO optimization

**Benefits**:
- Faster initial page loads
- Reduced client-side JavaScript
- Better data fetching performance
- Enhanced SEO capabilities
- Improved Core Web Vitals

**Implementation Patterns**:
```javascript
// Server Component (runs on server)
export default async function Users() {
  const users = await getUsers(); // Server-side data fetching
  return <UserList users={users} />;
}

// No useEffect needed for initial data
```

**Framework Support**:
- Next.js: Full support with App Router
- Other frameworks: Experimental support
- Bundler APIs: Not semver-stable (pin React version)

### 3. Actions - Enhanced Form and State Management

**Revolutionary Feature**: Simplified async state management

**What Actions Do**:
- Handle pending states automatically
- Manage errors seamlessly
- Support optimistic updates
- Coordinate state updates with UI rendering
- Integrate with forms natively

**New Hook: useActionState**
```javascript
// Before React 19
function UpdateName() {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    setIsPending(true);
    const error = await updateName(name);
    setIsPending(false);
    if (error) {
      setError(error);
      return;
    }
    redirect("/path");
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}

// React 19 with Actions
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(
    async (previousState, formData) => {
      const error = await updateName(formData.get("name"));
      if (error) return error;
      redirect("/path");
      return null;
    },
    null
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button type="submit" disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### 4. New Hook: useOptimistic

**Purpose**: Optimistic UI updates

**Benefits**:
- Immediate user feedback
- Better user experience during async operations
- Automatic reversion on failure

**Example**:
```javascript
function ChangeName({currentName, onUpdateName}) {
  const [optimisticName, setOptimisticName] = useOptimistic(currentName);

  const submitAction = async formData => {
    const newName = formData.get("name");
    setOptimisticName(newName); // Immediate UI update
    const updatedName = await updateName(newName);
    onUpdateName(updatedName);
  };

  return (
    <form action={submitAction}>
      <p>Your name is: {optimisticName}</p>
      <input type="text" name="name" disabled={currentName !== optimisticName} />
    </form>
  );
}
```

### 5. New API: use()

**Revolutionary Feature**: Resource consumption in render

**Capabilities**:
- Read promises directly in render
- Read context conditionally
- Works with Suspense boundaries
- Conditional usage (unlike other hooks)

**Promise Example**:
```javascript
import {use} from 'react';

function Comments({commentsPromise}) {
  // use() will suspend until promise resolves
  const comments = use(commentsPromise);
  return comments.map(comment => <p key={comment.id}>{comment}</p>);
}

function Page({commentsPromise}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

**Context Example**:
```javascript
import {use} from 'react';
import ThemeContext from './ThemeContext';

function Heading({children}) {
  if (children == null) {
    return null;
  }
  
  // This works with use() but not useContext
  const theme = use(ThemeContext);
  return (
    <h1 style={{color: theme.color}}>
      {children}
    </h1>
  );
}
```

### 6. Enhanced Form Handling

**New Hook: useFormStatus**
```javascript
import {useFormStatus} from 'react-dom';

function DesignButton() {
  const {pending} = useFormStatus();
  return <button type="submit" disabled={pending} />
}
```

**Form Actions**:
- Native `<form>` action support
- Automatic form reset after submission
- Better form state management
- Integration with Actions

### 7. New React DOM Static APIs

**For Static Site Generation**:
- `prerender()`: Generate static HTML with data loading
- `prerenderToNodeStream()`: Streaming version for Node.js

**Benefits**:
- Better than `renderToString`
- Waits for all data to load
- Streaming support
- Improved SSG performance

```javascript
import { prerender } from 'react-dom/static';

async function handler(request) {
  const {prelude} = await prerender(<App />, {
    bootstrapScripts: ['/main.js']
  });
  
  return new Response(prelude, {
    headers: { 'content-type': 'text/html' },
  });
}
```

## Major Improvements

### 1. ref as a Prop

**Breaking Change**: No more forwardRef needed

```javascript
// Before React 19
import { forwardRef } from 'react';

const Input = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

// React 19
function Input({placeholder, ref}) {
  return <input placeholder={placeholder} ref={ref} />
}

// Usage remains the same
<Input ref={ref} />
```

**Benefits**:
- Simpler component composition
- Reduced boilerplate
- Better TypeScript integration
- Cleaner code

### 2. Improved Hydration Error Reporting

**Before React 19**: Multiple confusing errors
**React 19**: Single clear diff showing mismatches

```
Hydration Error:
<App>
  <span>
    + Client
    - Server
```

**Common Causes**:
- `Date.now()` or `Math.random()` differences
- Locale-dependent formatting
- External data changes
- Invalid HTML nesting
- Browser extensions

### 3. Context as Provider

**Simplified Context API**:

```javascript
const ThemeContext = createContext('');

// Before React 19
function App({children}) {
  return (
    <ThemeContext.Provider value="dark">
      {children}
    </ThemeContext.Provider>
  );
}

// React 19
function App({children}) {
  return (
    <ThemeContext value="dark">
      {children}
    </ThemeContext>
  );
}
```

### 4. Cleanup Functions for refs

**New Feature**: Return cleanup function from ref callback

```javascript
<input
  ref={(ref) => {
    // ref created
    
    // NEW: return cleanup function
    return () => {
      // ref cleanup
    };
  }}
/>
```

**Benefits**:
- Automatic cleanup on unmount
- Better resource management
- Memory leak prevention

### 5. Document Metadata Support

**Native Support**: No more react-helmet needed

```javascript
function BlogPost({post}) {
  return (
    <article>
      <h1>{post.title}</h1>
      <title>{post.title}</title>
      <meta name="author" content="Josh" />
      <link rel="author" href="https://twitter.com/joshcstory/" />
      <meta name="keywords" content={post.keywords} />
      <p>Content...</p>
    </article>
  );
}
```

**Benefits**:
- Automatic hoisting to `<head>`
- Works with SSR and client-side
- Better SEO management
- Simpler implementation

### 6. Stylesheet Support

**Advanced CSS Integration**:

```javascript
function ComponentOne() {
  return (
    <Suspense fallback="loading...">
      <link rel="stylesheet" href="foo" precedence="default" />
      <link rel="stylesheet" href="bar" precedence="high" />
      <article className="foo-class bar-class">
        {/* content */}
      </article>
    </Suspense>
  );
}
```

**Features**:
- Precedence control
- Automatic deduplication
- Load order management
- SSR/CSR coordination

### 7. Async Script Support

**Better Script Loading**:

```javascript
function MyComponent() {
  return (
    <div>
      <script async={true} src="..." />
      Hello World
    </div>
  );
}
```

**Benefits**:
- Automatic deduplication
- Proper load ordering
- SSR optimization

### 8. Resource Preloading APIs

**New Functions**:
```javascript
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom';

function MyComponent() {
  preinit('https://example.com/script.js', {as: 'script'});
  preload('https://example.com/font.woff', {as: 'font'});
  preload('https://example.com/style.css', {as: 'style'});
  prefetchDNS('https://example.com');
  preconnect('https://example.com');
}
```

## Breaking Changes and Deprecations

### 1. JSX Transform Requirement

**Breaking Change**: New JSX transform mandatory

- Enables ref as props
- Better performance
- Required for React 19 features

### 2. Removed APIs

**ReactDOM Rendering APIs**:
```javascript
// ❌ Removed in React 19
ReactDOM.render(<App />, document.getElementById('root'));
ReactDOM.hydrate(<App />, document.getElementById('root'));
ReactDOM.unmountComponentAtNode(container);
ReactDOM.findDOMNode(component);

// ✅ React 19 (available since React 18)
import { createRoot } from 'react-dom/client';
import { hydrateRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// For SSR
hydrateRoot(document.getElementById('root'), <App />);
```

**Other Removed APIs**:
- `defaultProps` for function components (use default parameters)
- String refs (use callback refs)
- Legacy Context API (use createContext)
- `react-test-renderer` (deprecated, use React Testing Library)
- UMD builds (use ESM-based CDNs)

### 3. PropTypes Removal

**Breaking Change**: PropTypes no longer checked

```javascript
// ❌ No longer works in React 19
import PropTypes from 'prop-types';

function Heading({text}) {
  return <h1>{text}</h1>;
}

Heading.propTypes = {
  text: PropTypes.string,
};

Heading.defaultProps = {
  text: 'Hello, world!',
};

// ✅ React 19 approach
interface Props {
  text?: string;
}

function Heading({text = 'Hello, world!'}: Props) {
  return <h1>{text}</h1>;
}
```

### 4. Error Handling Changes

**New Error Reporting**:
- Uncaught errors → `window.reportError`
- Caught errors → `console.error`
- New root options: `onCaughtError`, `onUncaughtError`

### 5. Module Pattern Components

**Removed**: Factory components returning objects with render method

```javascript
// ❌ No longer supported
function ComponentFactory() {
  return {
    render() {
      return <div>Hello</div>;
    }
  };
}

// ✅ Use regular function components
function Component() {
  return <div>Hello</div>;
}
```

## Migration Guide

### Prerequisites

1. **Prepare with React 18.3**:
   ```bash
   npm install react@18.3.1 react-dom@18.3.1
   ```
   - Identical to 18.2 but adds warnings for deprecated APIs
   - Helps identify issues before upgrading

### Step 1: Update Dependencies

```bash
npm install react@19 react-dom@19
```

### Step 2: Update Rendering APIs

```javascript
// Before
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// After
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

### Step 3: Remove Deprecated Features

1. **Replace PropTypes**:
   ```javascript
   // Before
   Component.propTypes = { /* ... */ };
   Component.defaultProps = { /* ... */ };
   
   // After
   function Component({prop = defaultValue}: {prop?: string}) {
     // component logic
   }
   ```

2. **Update String Refs**:
   ```javascript
   // Before
   class MyComponent extends React.Component {
     componentDidMount() {
       this.refs.input.focus();
     }
     render() {
       return <input ref='input' />;
     }
   }
   
   // After
   class MyComponent extends React.Component {
     componentDidMount() {
       this.input.focus();
     }
     render() {
       return <input ref={input => this.input = input} />;
     }
   }
   ```

3. **Replace forwardRef**:
   ```javascript
   // Before
   const Input = forwardRef((props, ref) => (
     <input ref={ref} {...props} />
   ));
   
   // After
   function Input({ref, ...props}) {
     return <input ref={ref} {...props} />;
   }
   ```

### Step 4: Adopt New Features (Optional)

1. **Try React Compiler**:
   ```bash
   npm install babel-plugin-react-compiler
   ```

2. **Use New Hooks**:
   - Replace manual form state with `useActionState`
   - Add optimistic updates with `useOptimistic`
   - Use `use()` for conditional context reading

3. **Leverage Actions**:
   - Simplify form handling
   - Reduce boilerplate code
   - Better error handling

### Step 5: Test Thoroughly

- [ ] All components render correctly
- [ ] Forms work as expected
- [ ] No console errors or warnings
- [ ] Performance is maintained or improved
- [ ] Tests pass

## Performance Improvements

### Automatic Optimizations
- React Compiler handles memoization
- Better concurrent rendering
- Improved hydration performance
- Reduced bundle sizes with Server Components

### Memory Management
- Better cleanup with ref cleanup functions
- Improved garbage collection
- Reduced memory leaks

### Rendering Performance
- Faster initial page loads (Server Components)
- Better streaming SSR
- Improved hydration speed
- More efficient re-renders

## Framework Compatibility

### Next.js
- Full React 19 support in App Router
- Server Components fully supported
- Enhanced performance with React Compiler

### Other Frameworks
- Remix: Working on React 19 support
- Gatsby: Planned support
- Create React App: Deprecated (use Vite)

## TypeScript Support

- Full TypeScript support
- Updated type definitions
- Better inference with new APIs
- Improved error messages

## Testing with React 19

### Jest/Testing Library
```javascript
// Update testing setup
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// Use act from React core (not react-dom/test-utils)
```

### Migration from react-test-renderer
- **Status**: Deprecated
- **Recommendation**: Use React Testing Library
- **Reason**: Better matches user interactions

## Common Migration Issues

### 1. Build Tool Configuration
- **Vite**: Update to latest version for React 19 support
- **Webpack**: Ensure JSX transform configuration
- **Babel**: Update presets and plugins

### 2. Third-party Libraries
- Check React 19 compatibility
- Update to latest versions
- Replace incompatible libraries

### 3. SSR Applications
- Update hydration APIs
- Test server/client rendering consistency
- Verify metadata handling

## Performance Benchmarks

### React Compiler Impact
- **Instagram**: Significant performance improvements in production
- **Bundle Size**: Reduced with automatic optimizations
- **Runtime**: Faster re-renders with intelligent memoization

### Server Components Benefits
- **Initial Load**: 20-50% faster (depending on app complexity)
- **JavaScript Bundle**: 30-60% reduction in client-side code
- **Time to Interactive**: Improved with less client-side processing

## Best Practices for React 19

### 1. Gradual Adoption
- Start with React Compiler on specific components
- Migrate forms to Actions incrementally
- Use Server Components for static content first

### 2. Performance Monitoring
- Measure before/after migration
- Monitor Core Web Vitals
- Track bundle size changes

### 3. Code Organization
- Separate Server and Client Components clearly
- Use Actions for data mutations
- Leverage new metadata APIs for SEO

## Future Roadmap

### React 19.x (Minor Releases)
- Bug fixes and performance improvements
- Additional React Compiler optimizations
- Better framework integration

### React 20 (Future Major)
- React Compiler as default
- Further Server Components enhancements
- Additional performance optimizations

## Resources

- [React 19 Release Post](https://react.dev/blog/2024/12/05/react-19)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React Compiler Documentation](https://react.dev/learn/react-compiler)
- [Server Components Guide](https://react.dev/reference/rsc/server-components)
- [Actions Documentation](https://react.dev/reference/react-dom/components/form)

## Community Support

- [React GitHub Discussions](https://github.com/facebook/react/discussions)
- [React Discord Community](https://discord.gg/react)
- [Reddit r/reactjs](https://reddit.com/r/reactjs)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/reactjs)

---

**Note**: This changelog represents a comprehensive overview of React 19 changes. Always refer to the official React documentation for the most current information and detailed API references.