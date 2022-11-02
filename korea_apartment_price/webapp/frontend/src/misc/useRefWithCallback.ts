import * as React from 'react';

export default function useRefWithCallback<T>(onMount: (node: T) => any, onUnmount: (node: T) => any): [React.MutableRefObject<T|null>, (node:T)=>void] {
  const nodeRef = React.useRef<T | null>(null);
  const setRef = React.useCallback((node: T) => {
    if (nodeRef.current) {
      onUnmount(nodeRef.current);
    }

    nodeRef.current = node;

    if (nodeRef.current) {
      onMount(nodeRef.current);
    }
  }, [onMount, onUnmount]);

  return [nodeRef, setRef];
}