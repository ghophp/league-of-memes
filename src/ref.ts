import * as React from "react";

const map = new Map<string, React.RefObject<HTMLInputElement>>();

function setRef<T>(key: string): React.RefObject<HTMLInputElement> {
  const ref = React.createRef<HTMLInputElement>();
  map.set(key, ref);
  return ref;
}

function getRef<T>(key: string): React.RefObject<HTMLInputElement> {
  return map.get(key) as React.RefObject<HTMLInputElement>;
}

function useDynamicRefs<T>(): [
  (key: string) => React.RefObject<HTMLInputElement>,
  (key: string) => React.RefObject<HTMLInputElement>
] {
  return [getRef, setRef];
}

export default useDynamicRefs;
