# Task: Add Dark Mode

## What to do
Add a dark mode toggle using TailwindCSS `darkMode: 'class'` strategy with localStorage persistence. Add dark: variant classes to the Layout component.

## Files to create/modify

### 1. Check and update Tailwind config
Look for `web/tailwind.config.js` or `web/tailwind.config.ts` or `web/postcss.config.js` with tailwind plugin options. Add `darkMode: 'class'` to the Tailwind config.

If the config is in `web/tailwind.config.js`:
```js
module.exports = {
  darkMode: 'class',
  // ... rest of config
}
```

If there's no separate config file and Tailwind is configured via postcss.config.js, check how tailwindcss plugin is configured and add the darkMode option.

### 2. Create `web/src/hooks/useDarkMode.ts`
```tsx
import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dark-mode', String(dark));
  }, [dark]);

  const toggle = () => setDark(prev => !prev);
  return { dark, toggle };
}
```

### 3. Modify `web/src/main.tsx`
Add theme initialization BEFORE the React root render to prevent flash:
```tsx
// Prevent flash of wrong theme
const savedDark = localStorage.getItem('dark-mode');
if (savedDark === 'true' || (!savedDark && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}
```
Put this BEFORE the `ReactDOM.createRoot(...)` call.

### 4. Modify `web/src/components/Layout.tsx`
- Import `{ Moon, Sun } from 'lucide-react'`
- Import `{ useDarkMode } from '../hooks/useDarkMode'`
- Add `const { dark, toggle } = useDarkMode();` in Layout component
- Add a dark mode toggle button in the header. Place it next to the notification bell in the desktop header area (before the user name span). And in the mobile area (before the hamburger button).
- The button should show Sun icon when dark mode is on (click to go light), Moon icon when light mode is on (click to go dark)
- Add `dark:` variant classes to the main layout elements:
  - Outer div: `bg-gray-50 dark:bg-gray-950`
  - Header: `bg-white dark:bg-gray-900 border-b dark:border-gray-800`
  - Logo text: `text-gray-900 dark:text-white`
  - Desktop nav links: `text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800` / active: `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`
  - User info span: `text-gray-600 dark:text-gray-300`
  - Logout button: `text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400`
  - Mobile menu: `border-t border-gray-100 dark:border-gray-800`
  - Mobile nav links: same dark variants as desktop nav
  - Notification dropdown: `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700`, text colors
  - The dark mode toggle button: `text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800`
  - Main content area: `p-4 md:p-6` stays the same (bg is on parent)

## Constraints
- Do NOT modify any page components (they'll get dark mode support in future PRs)
- The dark mode toggle MUST NOT cause a flash of wrong theme on page load
- Must respect system preference (prefers-color-scheme) as the default
- Must persist user choice to localStorage

## Verification
- `cd web && npx tsc --noEmit` should pass
- `cd web && bun run build` should succeed
- Check that the dark mode toggle renders in the Layout header

Print DONE_WORKING when finished.
