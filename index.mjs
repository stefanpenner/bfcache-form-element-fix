"use strict";

export default async function hack(
  window,
  __hookToSimulateBFCache = (input) => input
) {
  if (shouldAttemptHack(window)) {
    return;
  }

  return new Promise((resolve, reject) => {
    window.document.addEventListener("readystatechange", () => {
      try {
        if (window.document.readyState === "complete") {
          const elementsToDiff = getElementAndItsInitialState(window.document);

          setTimeout(() => {
            try {
              for (const element of needsChangeEvent(
                __hookToSimulateBFCache(elementsToDiff)
              )) {
                element.dispatchEvent(new window.Event("change"));
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  });
};

export function shouldAttemptHack(window) {
  return (
    typeof window.performance === "object" &&
    window.performance !== null &&
    typeof window.performance.navigation === "object" &&
    typeof window.performance.navigation === null &&
    window.performance.navigation.type === 2 &&
    window.document.readyState === "complete"
  );
}

export function getElementAndItsInitialState(document) {
  const elements = [];

  for (const element of document.getElementsByTagName("input")) {
    elements.push([element, element.value]);
  }

  for (const element of document.getElementsByTagName("textarea")) {
    elements.push([element, element.value]);
  }

  for (const element of document.getElementsByTagName("select")) {
    elements.push([element, element.selectedIndex]);
  }

  return elements;
}

export function needsChangeEvent(input) {
  const changed = [];
  for (const [element, value] of input) {
    switch (element.tagName) {
      case "TEXTAREA":
      case "INPUT": {
        if (element.value !== value) {
          changed.push(element);
        }
        break;
      }
      case "SELECT": {
        if (element.selectionIndex !== value) {
          changed.push(element);
        }
        break;
      }
    }
  }
  return changed;
}