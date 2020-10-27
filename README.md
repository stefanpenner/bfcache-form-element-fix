# BFCache Form Element Fix ![CI](https://github.com/stefanpenner/bfcache-form-element-fix/workflows/CI/badge.svg)

BFCache in chrome (as of <???>) may update form elements state without
emitting the corresponding change events, this can lead to broken form logic.

This occurs when:
1) you have at-least 1 page in history (back button can be pressed)
2) the current page has a form element, such as an `<input>`
3) you update the `<input` with the text `"foo"`
4) you press the back button
5) you press the forward button
6) that `<input` continus to contain `"foo"`

Issue:

The value of `input` changes without a change event being emitted. Which can result in the UI becoming out-of-sync with the backing data.

Interesting details:

* the `<input` in question was rendered by the Server or the client  without `<input` having `"foo"` as a value AND the page is not informed of this change (via `change` event, or `input` or similar)
* the page may begin life without the `input` containing `"foo"` but around `readyState === 'complete'` the cached value from BFCache is applied.



This repo aims to provide both a reproduction, and a possible workaround.

## Usage:

## Steps to reproduce:
