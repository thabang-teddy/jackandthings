import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'jackandthings:theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
    if (typeof window === 'undefined') {
        return 'light';
    }

    return window.localStorage.getItem(STORAGE_KEY) === 'glass'
        ? 'glass'
        : 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(readStoredTheme);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((current) => (current === 'glass' ? 'light' : 'glass'));
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
