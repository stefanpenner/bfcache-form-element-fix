"use strict";
import chai from 'chai';
import jsdom from 'jsdom';
import hack, { needsChangeEvent, getElementAndItsInitialState } from "./index.mjs";
import cdc from 'chrome-debugging-client';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import server from './server.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url));

const { spawnChrome } = cdc;
const { expect } = chai;

function DOM(string) {
  return new jsdom.JSDOM(string).window;
}

describe("hack", function () {

  it("no events, if nothing went wrong", async function () {
    const window = DOM`
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
    const window = DOM`
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
    const initialState = getElementAndItsInitialState(
      DOM`
    <div></div>
    <input>
    <div></div>
    <select><option></option><option></option></select>
    <div></div>
    <textarea></textarea>
    <span></span>
    <label></label>
    `.document
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
    const dom = DOM`
    <input>
    <select><option></option><option></option></select>
    <textarea></textarea>
    `;
    const input = dom.window.document.getElementsByTagName("input")[0];
    const textarea = dom.window.document.getElementsByTagName("textarea")[0];
    const select = dom.window.document.getElementsByTagName("select")[0];

    expect(needsChangeEvent([])).to.eql([]);
    expect(needsChangeEvent([])).to.eql([]);
    expect(needsChangeEvent([[input, ""]])).to.eql([]);
    expect(needsChangeEvent([[textarea, ""]])).to.eql([]);
    expect(
      needsChangeEvent([
        [textarea, ""],
        [input, ""],
      ])
    ).to.eql([]);

    input.value = "new value";
    expect(needsChangeEvent([[input, ""]])).to.eql([input]);
    expect(needsChangeEvent([[input, "new value"]])).to.eql([]);

    textarea.value = "new value";
    expect(needsChangeEvent([[textarea, ""]])).to.eql([textarea]);
    expect(needsChangeEvent([[textarea, "new value"]])).to.eql([]);

    expect(
      needsChangeEvent([[textarea, "new value"], [[input, "new value"]]])
    ).to.eql([]);
  });
});

describe("reproduction", function () {
  this.timeout(300_000);
  let chrome, page, app;
  const URL = 'http://localhost:48888';
  beforeEach(async function() {
    app = await server(URL);
    chrome = spawnChrome({ headless: true });
    page = await setup(chrome);
  });

  afterEach(async function() {
    await app.close();
    await chrome.dispose();
  });

  describe('no-fix', function() {
    it("expects no input event for BFCache populated value", async function () {
      await navigateTo(page, `${URL}/reproductions/one.html`);
      await updateInputValue(page);

      // grab the history details so we can navigate forwards/backwards
      const history = await page.send("Page.getNavigationHistory");

      await pressBack(page, history)

      const LOGS = [];
      // subscribe to logging
      page.on('Runtime.consoleAPICalled', e => {
        if (e.type === 'log') {
          LOGS.push(e)
        }
      });

      await pressForward(page, history);
      expect(await getInputsValue(page)).to.eql('P'); // BFCache has populated this `P`
      // this assertion makes sense the input actually did fire
      expect(LOGS.flatMap(x => x.args.map(x => x.value))).to.not.include(
        'CHANGE: INPUT did changed'
      );
    });
  });

  describe('with-fix', function() {
    it("expects input event for BFCache populated value", async function () {
      await navigateTo(page, `http://localhost:48888/reproductions/one-fixed.html`);
      await updateInputValue(page);

      // grab the history details so we can navigate forwards/backwards
      const history = await page.send("Page.getNavigationHistory");

      await pressBack(page, history)

      const LOGS = [];
      // subscribe to logging
      page.on('Runtime.consoleAPICalled', e => {
        if (e.type === 'log') {
          LOGS.push(e)
        }
      });

      await pressForward(page, history);
      expect(await getInputsValue(page)).to.eql('P'); // BFCache has populated this `P`
      // this assertion makes sense the input actually did fire
      expect(LOGS.flatMap(x => x.args.map(x => x.value))).to.include(
        'CHANGE: INPUT did changed'
      );
    });
  });
});


async function updateInputValue(page) {
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

async function pressBack(page, history) {
  await Promise.all([
    page.until("Page.loadEventFired"),
    page.send("Page.navigateToHistoryEntry", {
      entryId: history.entries[history.entries.length - 2].id
    })
  ]);
}

async function navigateTo(page, url) {
  // navigate to reproduction
  await Promise.all([
    page.until("Page.loadEventFired"),
    page.send("Page.navigate", {
      url
    }),
  ]);
}

async function setup(chrome) {
  const browser = chrome.connection;

  const { targetId } = await browser.send("Target.createTarget", {
    url: "about:blank",
  });

  const page = await browser.attachToTarget(targetId);
  // enable events for Page domain
  await page.send("Page.enable");
  await page.send("Runtime.enable");

  return page;
}

async function pressForward(page, history) {
  await Promise.all([
    page.until("Page.loadEventFired"),
    page.send("Page.navigateToHistoryEntry", {
      entryId: history.entries[history.entries.length - 1].id
    })
  ]);
}

    // grab the inputs value, ensure it is restored back to P.
async function getInputsValue(page) {
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
  return properties.result.filter(x => x.name === 'value')[0].value.value;

}

