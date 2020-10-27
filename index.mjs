"use strict";

export default async function hack(
  window,
  __hookToSimulateBFCache = (input) => input
) {
  if (shouldAttemptHack(window)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const elementsToDiff = getElementAndItsInitialState(window.document);
    window.document.addEventListener("readystatechange", () => {
      try {
        if (window.document.readyState === 'complete') {
          setTimeout(() => {
            try {
              for (const element of needsChangeEvent(
                __hookToSimulateBFCache(elementsToDiff)
              )) {
                console.log('dispatch', element)
                // TODO: this likely needs to be more comphrensive
                element.dispatchEvent(new window.Event("change"));
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        } else {
          for (const [element, previous] of __hookToSimulateBFCache(getElementAndItsInitialState(window.document))) {
            if (elementsToDiff.find(pair => pair[0] === element)) {
              continue;
            }

            elementsToDiff.push([
              element,
              previous
            ])
          }
          // TODO: it may be possible to see new elements here that must be merged with elementsToDiff,
          // deferring to elements initial states that already exist
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
    typeof window.performance.navigation !== null &&
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
        if (element.selectedIndex !== value) {
          changed.push(element);
        }
        break;
      }
    }
  }
  return changed;
}
