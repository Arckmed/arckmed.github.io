document.addEventListener("DOMContentLoaded", () => {
    const blocks = document.querySelectorAll(".post-content pre");

    const clipboard_icon = `
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="currentColor"
                d="M9 4.75A2.75 2.75 0 0 1 11.75 2h.5A2.75 2.75 0 0 1 15 4.75V5h1.25A2.75 2.75 0 0 1 19 7.75v10.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V7.75A2.75 2.75 0 0 1 7.75 5H9v-.25Zm2.75-1.25A1.25 1.25 0 0 0 10.5 4.75v.5c0 .69.56 1.25 1.25 1.25h.5c.69 0 1.25-.56 1.25-1.25v-.5a1.25 1.25 0 0 0-1.25-1.25h-.5ZM7.75 6.5A1.25 1.25 0 0 0 6.5 7.75v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V7.75c0-.69-.56-1.25-1.25-1.25H15a2.75 2.75 0 0 1-2.75 1.5h-.5A2.75 2.75 0 0 1 9 6.5H7.75Z"
            />
        </svg>
    `;

    for (const pre of blocks) {
        const code = pre.querySelector("code");
        if (!code) {
            continue;
        }

        let wrapper = pre.closest(".highlight");

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.className = "code-block-wrapper";
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
        }

        if (wrapper.querySelector(":scope > .copy-code-button")) {
            continue;
        }

        const button = document.createElement("button");
        button.className = "copy-code-button";
        button.type = "button";
        button.setAttribute("aria-label", "copy code");
        button.setAttribute("title", "copy code");
        button.innerHTML = clipboard_icon;

        button.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(code.textContent);

                button.textContent = "copied";
                button.classList.add("copied");
                button.setAttribute("aria-label", "code copied");
                button.setAttribute("title", "code copied");

                window.setTimeout(() => {
                    button.innerHTML = clipboard_icon;
                    button.classList.remove("copied");
                    button.setAttribute("aria-label", "copy code");
                    button.setAttribute("title", "copy code");
                }, 1200);
            } catch (error) {
                console.error("failed to copy code", error);
            }
        });

        wrapper.appendChild(button);
    }
});
