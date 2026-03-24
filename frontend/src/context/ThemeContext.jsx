import { createContext, useContext } from "react";
import useDarkMode from "../hooks/useDarkMode";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, toggleTheme] = useDarkMode();
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
