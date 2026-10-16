# Manual code highlighting

Color code snippets by hand before publishing. Hugo's ordinary fenced blocks can remain for drafts and posts that have not received a manual pass. There is no automatic semantic coloring step.

## Markup

Use a raw HTML block in the Markdown post. Goldmark's `unsafe = true` setting allows the spans to pass through. Keep the language on `<code>` and put `semantic-code` on `<pre>`:

```html
<pre class="semantic-code"><code class="language-cpp" data-lang="cpp"><span class="sh-keyword">struct</span> <span class="sh-type-struct">Example</span>
{
    <span class="sh-type-primitive">int</span> <span class="sh-field">value</span>;
};
</code></pre>
```

The first source character follows the opening `<code>` tag. The closing `</code>` follows the final source newline. Do not indent the markup for presentation: every character outside a span but inside `<code>` is part of the code copied by the button. Spans carry color only. Do not put line numbers, badges, explanatory text, or CSS-generated code inside the code element. Escape source characters that HTML treats specially (`&` as `&amp;`, `<` as `&lt;`, and `>` as `&gt;` where appropriate); the browser's `textContent` must still equal the original source.

## Palette and roles

The palette is tuned for the blog's `#232323` code background and rose accent. CSS rules live in `static/css/style.css` under `.semantic-code`; these class names are shared by languages.

| Class | Role | Color |
| --- | --- | --- |
| `sh-keyword` | Language and control keywords, including `this`, `auto`, `return`, `struct`, and `enum` | `#c78f8f` |
| `sh-preprocessor` | Directive names such as `include` and `define` | `#c78f8f` |
| `sh-macro` | Macro names at definition and use sites | `#d4a6a6` |
| `sh-type-primitive` | Built-in scalar types such as `int`, `bool`, and `char` | `#9bbfd4` |
| `sh-type-alias` | Typedefs and type aliases, including platform aliases such as `DWORD` | `#a8c9da` |
| `sh-type-struct`, `sh-type-class`, `sh-type-union`, `sh-type-enum`, `sh-type-concept` | Named type by its declared kind | `#b3acd6` |
| `sh-type-template-param` | Type or value template parameter used as a type or compile-time symbol | `#c1b8dc` |
| `sh-enum-member` | Enumerator names at declaration and use sites | `#d4b985` |
| `sh-number`, `sh-boolean`, `sh-null` | Numeric, Boolean, and null literals | `#d8ab87` |
| `sh-string`, `sh-character` | String and character literals | `#c4b77f` |
| `sh-function`, `sh-method`, `sh-constructor`, `sh-destructor` | Callable names by role | `#b7a6d8` |
| `sh-namespace` | Namespace or module name | `#a9a0d0` |
| `sh-field` | Instance field or property, including access through a local or `this` | `#91c2ba` |
| `sh-static-field`, `sh-global` | Static member or global/module variable | `#a7ccc3` |
| `sh-parameter` | Function parameter | `#dfc5ad` |
| `sh-local` | Local variable | `#e3e3e3` |
| `sh-label`, `sh-register` | Branch label or machine register | `#adbeda` |
| `sh-instruction` | Assembly mnemonic | `#c78f8f` |
| `sh-comment` | Comment text, including markers | `#9ca49f` |

Plain punctuation and operators use the surrounding code color. A role gets the same class at its declaration and at every reference. Classify a token from its meaning in the snippet, including the receiver of a member access: in `mapView->m_nLockState`, `mapView` is local and `m_nLockState` is a field. In `this->counter`, `this` is a keyword and `counter` is a field. An identifier's spelling alone does not determine its class. When context is insufficient to identify a role reliably, leave it plain instead of guessing.

For a new language, reuse these roles where they fit. Add a clearly named class and a scoped CSS rule only when the language needs a genuinely new role; document the distinction here. Keep related roles visually close so the code stays readable.

## Before publishing

1. Save the original text of each fenced code block before replacing it.
2. Mark semantic tokens without changing code, indentation, blank lines, or trailing spaces.
3. Build the site and compare each rendered `<code>.textContent` with the saved original, character for character. HTML entities should decode to the original characters.
4. Click the copy button and compare the clipboard with the same original. Check text selection as well.

The copy button in `static/js/copy.js` reads `code.textContent`; color spans contribute no markup to that value.
