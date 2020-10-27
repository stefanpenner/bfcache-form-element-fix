"use strict";
const { expect } = require("chai");
const jsdom = require("jsdom");
const hack = require("./index.js");

function HTML(string) {
  return new jsdom.JSDOM(string).window;
}

describe("hack", function () {
  it("no events, if nothing went wrong", async function () {
    const window = HTML`
    <div></div>
    <input>
    <div></div>
    <select><option></option><option></option></select>
    <div></div>
    <textarea></textarea>
    <span></span>
    <label></label>
    `.window;

    const events = [];

    window.document.addEventListener("change", (e) => events.push(e));

    await hack(window);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(events).to.eql([]);
  });

  it("events are emitted of BFCache did a thing", async function () {
    const window = HTML`
    <div></div>
    <input>
    <div></div>
    <select><option></option><option></option></select>
    <div></div>
    <textarea></textarea>
    <span></span>
    <label></label>
    `.window;

    const events = [];

    const input = window.document.getElementsByTagName("input")[0];
    input.addEventListener("change", (e) => events.push(e));

    function simulateBFCache(elementsToDiff) {
      // here we prevent
      elementsToDiff[0][1] = "new value";
      return elementsToDiff;
    }

    await hack(window, simulateBFCache);

    expect(events.length).to.eql(1);
    expect(events[0].target).to.eql(input);
  });
});

describe("getElementAndItsInitialState", function () {
  it("works", function () {
    const initialState = hack.getElementAndItsInitialState(
      new jsdom.JSDOM(`
    <div></div>
    <input>
    <div></div>
    <select><option></option><option></option></select>
    <div></div>
    <textarea></textarea>
    <span></span>
    <label></label>
    `).window.document
    );

    expect(initialState.length).to.eql(3);
    expect(initialState[0][0].tagName).to.eql("INPUT");
    expect(initialState[0][1]).to.eql("");

    expect(initialState[1][0].tagName).to.eql("TEXTAREA");
    expect(initialState[1][1]).to.eql("");

    expect(initialState[2][0].tagName).to.eql("SELECT");
    expect(initialState[2][1]).to.eql(0);
  });
});

describe("needsChangeEvent", function () {
  it("works", function () {
    const dom = new jsdom.JSDOM(`
    <input>
    <select><option></option><option></option></select>
    <textarea></textarea>
    `);
    const input = dom.window.document.getElementsByTagName("input")[0];
    const textarea = dom.window.document.getElementsByTagName("textarea")[0];
    const select = dom.window.document.getElementsByTagName("select")[0];

    expect(hack.needsChangeEvent([])).to.eql([]);
    expect(hack.needsChangeEvent([])).to.eql([]);
    expect(hack.needsChangeEvent([[input, ""]])).to.eql([]);
    expect(hack.needsChangeEvent([[textarea, ""]])).to.eql([]);
    expect(
      hack.needsChangeEvent([
        [textarea, ""],
        [input, ""],
      ])
    ).to.eql([]);

    input.value = "new value";
    expect(hack.needsChangeEvent([[input, ""]])).to.eql([input]);
    expect(hack.needsChangeEvent([[input, "new value"]])).to.eql([]);

    textarea.value = "new value";
    expect(hack.needsChangeEvent([[textarea, ""]])).to.eql([textarea]);
    expect(hack.needsChangeEvent([[textarea, "new value"]])).to.eql([]);

    expect(
      hack.needsChangeEvent([[textarea, "new value"], [[input, "new value"]]])
    ).to.eql([]);
  });
});

describe("reproduction", function () {
  this.timeout(300_000);
  const { spawnChrome } = require("chrome-debugging-client");
  it("works", async function () {
    const chrome = spawnChrome({
      headless: true
    });
    try {
      const browser = chrome.connection;

      const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank",
      });

      const page = await browser.attachToTarget(targetId);
      // enable events for Page domain
      await page.send("Page.enable");
      await page.send("Runtime.enable");

      {
        // navigate to reproduction
        await Promise.all([
          page.until("Page.loadEventFired"),
          page.send("Page.navigate", {
            url: `file://${__dirname}/reproductions/one.html`,
          }),
        ]);
      }

      // update input's value
      {
        const DOM = await page.send("DOM.getDocument");
        const input = await page.send("DOM.querySelector", {
          nodeId: DOM.root.nodeId,
          selector: "input",
        });
        await page.send('DOM.focus', {
          nodeId: input.nodeId,
        });

        await page.send('Input.dispatchKeyEvent', {
          type: "keyDown",
          text: "P"
        });
        await page.send('Input.dispatchKeyEvent', {
          type: "keyUp",
          text: "P"
        });
      }

      // grab the history details so we can navigate forwards/backwards
      const history = await page.send("Page.getNavigationHistory");

      // "press the back button"
      {
        await Promise.all([
          page.until("Page.loadEventFired"),
          page.send("Page.navigateToHistoryEntry", {
            entryId: history.entries[0].id
          })
        ]);
      }

      // "press the forward button"

      {
        // subscribe to logging
        await Promise.all([
          page.until("Page.loadEventFired"),
          page.send("Page.navigateToHistoryEntry", {
            entryId: history.entries[1].id
          })
        ]);
      }

      // grab the inputs value, ensure it is restored back to P.
      {
        const DOM = await page.send("DOM.getDocument");
        const input = await page.send("DOM.querySelector", {
          nodeId: DOM.root.nodeId,
          selector: "input",
        });

        const value = await page.send('DOM.resolveNode', {
          nodeId: input.nodeId
        });
        const objectId = value.object.objectId;
        const properties = await page.send('Runtime.getProperties', {
          objectId,
          generatePreview: true
        });
        const inputValue = properties.result.filter(x => x.name === 'value')[0].value.value;

        expect(inputValue).to.eql('P');
      }

      // assert logging
    } finally {
      await chrome.dispose();
    }
  });
});
