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
