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

### Issue:

BFCache application can cause UI and DOM state can become out of sync.

For example, if we have form with dependent selects (the value of the primary select, changes the secondary select).
If a user updates `select#primary` to "Two", the `select#seconary` will be rendered. If at that point the user presses the "back button", followed by the "forwards button" they will end with `select#primary` having selected with "Two" but the `select#secondary` will not have been rendered.

Illustrating the example with some templates.

```html
<select id="primary" {{on "change" this.updateSelected}}>
  <option> One </option>
  <option> Two </option>
</select>

{{#if selected}}
  <select id="secondary">
    {{#each selected.options |option|}}
      <option> {{option.text}}</option>
    {{/each}}
  </select>
{{/if}}
```

Which can result in the UI becoming out-of-sync with the backing data.

### Interesting Details

* the `<input` in question was rendered by the Server or the client  without `<input` having `"foo"` as a value AND the page is not informed of this change (via `change` event, or `input` or similar)
* the page may begin life without the `input` containing `"foo"` but around `readyState === 'complete'` the cached value from BFCache is applied.



This repo aims to provide both a reproduction, and a possible workaround.

## Next Steps

* improve reproductions, to ensure they convey if the browser is affected more clearly
* Further testing & analysis is required to know the viability of workaround
* Investigate other browsers (Safari appears affected, but i need to confirm others etc)
