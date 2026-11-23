import { createContext, useContext } from "react";

/** Whether numbers are hidden, plus the toggle. The state itself lives at the top of App. */
export const HideContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });
export const useHide = () => useContext(HideContext);
