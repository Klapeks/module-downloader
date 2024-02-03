#!/usr/bin/env node

"use strict";

/** @param {string[]} args  */
function init(args) {
    if (args[0].endsWith('node')) {
        args = args.slice(1);
    }
    if (args.includes('-f')) {
        const i = args.indexOf('-f')
        require('./index').downloadAll(args[i+1]);
        return;
    }
    args = args.filter(Boolean);
    console.log('args', args);
    throw new Error("?? cli not found?? " + JSON.stringify(args));
}
init(process.argv);
