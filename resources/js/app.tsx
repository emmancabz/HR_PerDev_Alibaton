import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Alibaton Workforce Portal';

const persistedTheme = typeof window !== 'undefined'
    ? window.localStorage.getItem('pd_theme_preference')
    : null;
const initialTheme = persistedTheme === 'dark' ? 'dark' : 'light';

if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    document.documentElement.dataset.theme = initialTheme;
    document.documentElement.style.colorScheme = initialTheme;
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        delay: 180,
        color: '#4B5563',
        showSpinner: false,
    },
});
