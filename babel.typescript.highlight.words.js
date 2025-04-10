// ==UserScript==
// @name         Babel TypeScript Highlight Words
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically clicks the highlight words button and posts the highlighted words as JSON to the API endpoint in index.ts
// @author       robertgro
// @match        http://localhost:3000/ref/*
// @icon         data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎯</text></svg>
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function LoadNewRandomPage() {
        //console.log('This message is logged every 5 seconds.');

        // Random Link Click
        document.querySelector("body > nav > div > a:nth-child(3)").click();
    }

    function init() {
        // Initialize your script
        console.log('Script initialized');

        // Click the "Highlight Words" button
        document.querySelector("body > main > div.PageActions > button").click();

        // Get the current page reference
        const pageRef = window.location.pathname.replace("/ref/","");

        var words = [];

        // Wait for 5 seconds for the page to load
        setTimeout(() => {
            document.querySelectorAll("[data-word]").forEach((elem) => { words.push(elem.getAttribute("data-word")); });
            console.log(words, pageRef);
            fetch('http://localhost:3000/logdownload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': words.length,
                },
                body: JSON.stringify({words: words, pageRef: pageRef})
            }).then((response) => {
                console.log(response);
                })
        }, 5000);

        //document.querySelectorAll("[data-word]").forEach((elem) => { words.push(elem.getAttribute("data-word")); });

        // Must be at least 8 seconds for not so fast reloading (otherwise highlighted words can't be read)
        // 9 seconds as default
        setInterval(LoadNewRandomPage, 9000);
    }

    // Run when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
