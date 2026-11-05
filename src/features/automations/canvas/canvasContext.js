import { createContext, useContext } from 'react';

// Canvas-wide state the node components read (mode, selection, run state,
// stats), so node data stays just the layout item.
export const CanvasContext = createContext(null);
export const useCanvas = () => useContext(CanvasContext);
