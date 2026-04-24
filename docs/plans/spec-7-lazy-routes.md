# Task: Lazy Routes + Keyboard Shortcuts

## What to do
1. Convert all page imports in App.tsx to React.lazy() with Suspense
2. Add keyboard shortcuts: `/` to focus search, `n` to navigate to new product, `Esc` to close modals
3. Add useKeyboardShortcuts hook to Layout.tsx

## Files to create/modify

### 1. Create `web/src/components/LoadingFallback.tsx`
Simple loading spinner:
```tsx
export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
```

### 2. Create `web/src/hooks/useKeyboardShortcuts.ts`
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === '/') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('focus-search'));
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        navigate('/products?new=true');
      }
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('close-modals'));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
```

### 3. Modify `web/src/App.tsx`
- Remove all direct page imports (LoginPage, ProductsPage, etc.)
- Import `lazy, Suspense` from 'react'
- Import LoadingFallback
- Create lazy imports: `const LoginPage = lazy(() => import('./pages/LoginPage'));` etc for ALL pages
- Wrap the `<Routes>` inside `<Suspense fallback={<LoadingFallback />}>`
- The NotFoundPage should also be lazy loaded
- Keep ProtectedRoute and Layout as direct imports (they're small, loaded on every page anyway)

### 4. Modify `web/src/components/Layout.tsx`
- Import `{ useKeyboardShortcuts }` from '../hooks/useKeyboardShortcuts'
- Add `useKeyboardShortcuts();` call at the top of the Layout component body

## Constraints
- Do NOT change any page component internals
- Do NOT modify any API calls or hooks (except adding the new hook)
- The Suspense fallback should be the LoadingFallback component
- Keyboard shortcuts MUST check that the user isn't typing in an input/textarea first

## Verification
- `cd web && npx tsc --noEmit` should pass with no errors
- All page routes should still work (this is a refactor, not a behavior change)

Print DONE_WORKING when finished.
