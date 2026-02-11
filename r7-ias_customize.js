// ==UserScript==
// @name         R7 Customize
// @namespace    Dury.Dev.R7customize
// @version      2025-10-07
// @description  Make R7 IAS better
// @author       Charles-Ivan Dury
// @match         https://*.appsec.insight.rapid7.com/*
// @icon         https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://rapid7.com/&size=64
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        button._pendo-resource-center-badge-container {
            display:none !important;
        }

        div[data-testid='scan-config'] a {
            overflow: visible;
            white-space: break-spaces;
            width: max-content;
            height: max-content;
        }

        div.pendo-table-cell {
            width: 100%;
            height: max-content;
            white-space: normal;
        }

        div.pendo-table-cell span {
            vertical-align: text-top;
            width: 100%;
            max-width: 100%;
            max-height: 100%;
            white-space: normal;
            height: max-content;
            display: inline-block;
            font-size: 14px;
            line-height: 14px;
        }

        div.pendo-table-cell span.MuiChip-label.MuiChip-labelSmall {
            max-height: 30px;
        }

        div.ReactVirtualized__Table__rowColumn {
            height:max-content !important;
            padding:0 5px !important;
            max-height: 90%;
            /*min-width:1px !important;*/
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }

        div.MuiDataGrid-virtualScrollerContent div.MuiDataGrid-row {
            --height: 83px !important;
            max-height: 83px !important;
        }

        section.table {
            margin-bottom:3rem !important;
        }

        .ReactVirtualized__Table__rowColumn.checkbox-table-column {
            padding-bottom: 0 !important;
            padding-top: 5px !important;
        }

        .ReactVirtualized__Table__rowColumn.checkbox-table-column label.r7-checkbox-label.r7-checkbox-label--no-text::before {
            top:6px !important;
        }

        section[data-testid='scan-status-panel'] {
            height:max-content;
        }

        div.MuiDataGrid-cell {
            white-space: normal !important;
            overflow: visible !important;
            height: max-content !important;
            line-height: 14px !important;
            border: none !important;
            margin: auto !important;
        }
        div.MuiDataGrid-cell .MuiBox-root {
            text-align: left;
            text-overflow: ellipsis;
            /* overflow: visible; */
            left: 0;
            display: inline-block;
            height: max-content;
            /* height: 31px; */
            max-width: 100%;
            direction: ltr !important;
            white-space: normal !important;
        }
    `);

    const modalPortal = document.querySelector("div.modal-portal");
    const apiUrl = "https://eu.appsec.insight.rapid7.com/api/1";

    var requestListeners = [];
    var xcsrf_token="";
    var xxsrf_token="";
    var r7_product_token="";

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        return (originalFetch(...args));
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._method = method;
        this._url = url;
        this._requestHeaders = {}; // Initialize headers storage
        return originalOpen.apply(this, [method, url, ...args]);
    };

    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        this._requestHeaders[header] = value;
        return originalSetRequestHeader.apply(this, arguments);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
        //console.log('📤 XHR:', this._method, this._url);
        const headers = this._requestHeaders;
        if (Object.keys(headers).includes("X-CSRF-TOKEN")) {
            //console.log(this._url, xcsrf_token);
            xcsrf_token = headers["X-CSRF-TOKEN"];
        }
        if (Object.keys(headers).includes("X-XSRF-TOKEN")) {
            xxsrf_token = headers["X-XSRF-TOKEN"];
        }
        if (Object.keys(headers).includes("R7-Org-Product-Token")) {
            r7_product_token = headers["R7-Org-Product-Token"];
        }

        // Intercepter la réponse
        this.addEventListener('load', function () {
            /*console.log('📥 Réponse XHR:', this.responseURL);
            console.log('Status:', this.status);
            console.log('Data:', this.responseText);*/
            for (var rql of requestListeners) {
                if (rql.urlRegex.test(this.responseURL)) {
                    rql.callback(this);
                }
            }

        });

        return originalSend.apply(this, arguments);
    };

    function delAllModals() {
        while (modalPortal.firstChild) {
            modalPortal.lastChild.remove();
        }
    }

    function createModal(title, items=[]) {
        delAllModals();

        const ce = document.createElement("section");
        ce.className = "modal modalWithWizardStyles__StyledModalWithWizardContainer-sc-1bvgxws-0 eqLpnB modal--visible";
        
        var items_text = "";

        for (var it of items) {
            if (!["text_input", "textarea", "button"].includes(it.type)) {
                console.log(`Unknown item '${it.type}'`);
                continue;
            }
            if (items_text!="") {
                items_text+="\n\n";
            }

            if (it.type == "text_input") {
                items_text+=`<label class="r7-label">
                    <span class="r7-description">${it.label}</span>
                </label>
                <div>
                    <input placeholder="${it.placeholder??''}" id="${it.id}" type="text" class="modal_item r7-input addAppComponentStyles__StyledAppName-sc-14as6tk-13 giHeHo" value="${it.value??''}">
                </div>`;
            } else if (it.type == "textarea") {
                items_text+=`<label class="r7-label"><span class="r7-description">${it.label}</span></label>
                <div><textarea type="text" class="modal_item r7-textarea addAppComponentStyles__StyledAppDescription-sc-14as6tk-14 dnRGFV"
                        id="${it.id}" placeholder="${it.placeholder??''}"></textarea></div>`;
            } else if (it.type == "button") {
                items_text+=`<button id="${it.id}" type="button" class="modal_item btn btn--primary" data-analytics-rapid7-ui-component="button"
                    data-analytics-action="next-step-users">
                    ${it.label}
                </button>`;
            }
        }
        
        ce.innerHTML = `<div class="modal__overlay"></div>
            <div class="sc-bypJrT kLMnce modal__frame">
                <div class="modal__close">
                    <i class="r7-icon r7-icon-delete-x modal__close-icon"></i>
                </div>
                <div class="modal__content">
                    <h1 class="modal__title"></h1>
                    <section class="luxModal__StyledModelNotifications-sc-ybqz0v-1 bzCrdX">
                        <div class="sc-iMTnTL bzNRaS">
                            <ul class="notifications-group sc-krNlru jAGrIo"></ul>
                        </div>
                    </section>
                    <section class="luxModal__StyledContent-sc-ybqz0v-0 hBmnmp">
                        <header class="modalWithWizardStyles__StyledWizardModalHeader-sc-1bvgxws-1 ivDTRF">
                            <h2>${title}</h2>
                        </header>

                        <section class="modalWithWizardStyles__StyledWizardModalContent-sc-1bvgxws-2 duBnfw">
                            ${items_text}
                        </section>
                    </section>
                </div>
            </div>`;
        modalPortal.appendChild(ce);

        for (var it of items) {
            if (it.events) {
                for (var [evs, fct] of Object.entries(it.events)) {
                    for (var ev of evs.split("|")) {
                        var el = ce.querySelector(`.modal_item#${it.id}`);
                        if (el) {
                            el.addEventListener(ev, fct);
                        }
                    }
                }
            }

            if (it.attributes) {
                for (var [ks, v] of Object.entries(it.attributes)) {
                    for (var k of ks.split("|")) {
                        var el = ce.querySelector(`.modal_item#${it.id}`);
                        if (el) {
                            el.setAttribute(k, v);
                        }
                    }
                }
            }
        }
    }

    /* website loading
           <span class="MuiCircularProgress-root MuiCircularProgress-indeterminate MuiCircularProgress-colorPrimary css-1ez7ih5" role="progressbar" style="width: 40px; height: 40px;"><svg class="MuiCircularProgress-svg css-13o7eu2" viewBox="22 22 44 44"><circle class="MuiCircularProgress-circle MuiCircularProgress-circleIndeterminate css-14891ef" cx="44" cy="44" r="20.2" fill="none" stroke-width="3.6"></circle></svg></span>
    */

    /* data loading in dashboard
          <div class="dashboardView__StyledLoadingUIContainer-sc-10wfcjh-1 edJaIy"><section data-testid="loading-ui" class="loading-ui"><i class="r7-icon r7-icon-in-progress-circle u-is-loading loading-ui-icon" data-analytics-element="dashboard-loading"></i></section></div>
    */


    const rowHeight = 50;

    function updateRowSize() {
        console.log("UPDATE");

        var rows = document.querySelectorAll("div.ReactVirtualized__Grid__innerScrollContainer div.table__row");
        var ctn = document.querySelector("div.ReactVirtualized__Grid.ReactVirtualized__Table__Grid.table__body");
        var subctn = ctn.querySelector("div.ReactVirtualized__Grid__innerScrollContainer");
        ctn.style.height = `${rowHeight * rows.length}px`;
        subctn.style.maxHeight = subctn.style.height = `${rowHeight * rows.length}px`;

        for (var [i, e] of rows.entries()) {
            e.style.height = `${rowHeight}px`;
            e.style.top = `${i * rowHeight}px`;
        }
    }

    var childChangeListeners = [];

    const loadResultsObserver = new MutationObserver((mutations) => {
        mutations.forEach((mut) => {
            if (mut.type == "childList") {
                for (var lst of childChangeListeners) {
                    var ele = document.querySelector(lst.el);
                    if (ele != null && ele == mut.target) {
                        console.log("MUTATION");
                        lst.callback(mut);
                    }
                }
            }
        });
    });
    loadResultsObserver.observe(document, {
        childList: true,
        subtree: true
    });



    var lPageLoad = 0;
    var plInt = null;
    async function pageLoad(forceReload = false) {
        if (!forceReload) {
            var curr = (new Date).getTime();
            if ((curr - lPageLoad) < 300) {
                return;
            }
        }
        lPageLoad = curr;

        var pth = window.location.pathname;
        var pthh = window.location.href.split(window.location.host)[1];
        var hash = window.location.hash.split("#/")[1].split("?")[0];

        console.log(`Page is: '${hash}'`);


        var actt = document.querySelector(".tab-header__item.is-active");
        if (actt) {
            actt = actt.innerText;
            console.log(actt);
        }

        requestListeners = [];
        childChangeListeners = [];

        if (hash == "scans") {
            updateRowSize();
            childChangeListeners.push({
                el: "div.ReactVirtualized__Grid__innerScrollContainer",
                callback: (mut) => {
                    console.log("1");
                    updateRowSize();
                }
            });
        } else if (hash == "apps") {
            updateRowSize();
            childChangeListeners.push({
                el: "div.ReactVirtualized__Grid__innerScrollContainer",
                callback: (mut) => {
                    console.log("2");
                    updateRowSize();
                }
            });
        } else if (/apps\/[0-9a-z-]+\/vulnerabilities/.test(hash)) { // vulnerabilities
            const appid = hash.match(/apps\/([^\/]+)\/vulnerabilities/)[1];
            requestListeners.push({
                urlRegex: /\/api\/1\/vulnerabilities\/_search/,
                callback: (r) => {
                    var dt = JSON.parse(r.responseText);
                    console.log(dt);
                }
            });

            /*var rows = document.querySelectorAll("div.MuiDataGrid-virtualScrollerContent div.MuiDataGrid-row");
            const rowHeight = 100;
            for (var [i,e] of rows.entries()) {
                e.style.height = `${rowHeight}px`;
                e.style.top = `${i*rowHeight}px`;
            }*/
        } else if (/apps\/[0-9a-z-]+\/configuration\/[0-9a-z-]+\/scan\/[0-9a-z-]+/) { // scan page
            if (actt == "Vulnerabilities") {
            }
        } else if (/apps\/[0-9a-z-]+\/configuration\/[0-9a-z-]+/) { // config page
            //d
        }
    }

    window.addEventListener("hashchange", (e) => {
        pageLoad();
    });

    window.addEventListener("popstate", (e) => {
        pageLoad();
    });

    window.addEventListener("load", (e) => {
        console.log("R7 IAS Customize Loaded 👋");
        pageLoad(true);
    });


    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for removed nodes
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // 1 = Element node
                        if (node.classList.contains("MuiCircularProgress-indeterminate") || node.classList.contains("loading-ui")) {
                            pageLoad();
                        } else if (node.className && node.className.toString().includes("placeholder__PlaceholderAnimation")) {
                            pageLoad();
                        }
                    }
                });
            }
        });
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });

    function checkUrl(url) {
        try {
            const u = new URL(url);
            return(true);
        } catch (err) {
            return(false);
        }
    }

    async function getTags() {
        var r = await fetch(`${apiUrl}/tags`, {
            headers: {
                "x-xsrf-token": xxsrf_token,
                "r7-org-product-token": r7_product_token
            }
        });
        
        if (Math.floor(r.status/100)==2) {
            return(await r.json());
        } else {
            return(null);
        }
    }

    async function addTag(appid, tagid) {
        var r = await fetch(`${apiUrl}/apps/${appid}/tags`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                "r7-org-product-token": r7_product_token,
                "x-xsrf-token": xxsrf_token
            },
            body: JSON.stringify({
                "id": tagid
            })
        });

        if (Math.floor(r.status/100)==2) {
            return(true);
        }

        return(false);
    }

    async function createApp(appn, appdesc, tags=[], tgurls=[]) {
        var r = await fetch(`${apiUrl}/apps`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                "r7-org-product-token": r7_product_token,
                "x-xsrf-token": xxsrf_token
            },
            body: JSON.stringify({
                "name": appn,
                "description": appdesc
            })
        });

        if (Math.floor(r.status/100)==2) { // success
            var bd = await r.json();
            var appid = bd['uuid'];
            console.log(`Created app '${bd['name']}' (${appid})`);

            var avtags = await getTags();
            if (avtags==null) {
                console.log(`Failed to fetch tags`);
                return;
            }
            var ftgs=[];
            for (var tg of tags) {
                var ftg = avtags.find(e => e["name"].toLowerCase().trim()==tg.toLowerCase().trim());
                if (ftg) {
                    var adtg = await addTag(appid, ftg['id']);
                    if (!adtg) {
                        console.log(`Failed to add tag '${tg}'`);
                    }
                    ftgs.push(ftg);
                } else {
                    console.log(`Tag '${tg}' not found`);
                    return;
                }
            }
        } else {
            console.log(r);
            return(false);
        }
    }

    const shortcuts = {
        "ctrl+space": (ev) => {
            
        },
        "escape": () => {
            delAllModals();
        },
        "ctrl+alt+a": (ev)=>{
            createModal("Create App", [
                {
                    type: "text_input",
                    id: "app_name",
                    label: "App Name (Required)",
                    events: {
                        "update|keyup|change": (ev)=>{
                            const tg = ev.target;

                            if (tg.value=="") {
                                document.querySelector(".modal_item#submit_btn").disabled = "true";
                            } else {
                                document.querySelector(".modal_item#submit_btn").disabled = "";
                            }
                        }
                    }
                },
                {
                    type: "textarea",
                    id: "app_desc",
                    label: "Description (optional)",
                    placeholder: "Give this app a description to help users recognize it.",
                    attributes: {
                        "rows": 3
                    }
                },
                {
                    type: "textarea",
                    id: "app_urls",
                    label: "Target URLs (optional)",
                    placeholder: "Target URLs will be used by default when creating a scan config.",
                    attributes: {
                        "rows": 3
                    }
                },
                {
                    type: "button",
                    id: "submit_btn",
                    label: "Create App",
                    attributes: {
                        "disabled": "true"
                    },
                    events: {
                        "click": ()=>{
                            const appn_el = document.querySelector(".modal_item#app_name");
                            var appn = appn_el.value;
                            
                            const appdesc_el = document.querySelector(".modal_item#app_desc");
                            var appdesc = appdesc_el.value;

                            const appurls_el = document.querySelector(".modal_item#app_urls");
                            var appurls = appurls_el.value.split("\n").map(e => e.trim()).filter(e => e.trim()!="");
                            var invalid_urls = appurls.filter(e => !checkUrl(e));
                            console.log(appurls, invalid_urls);
                            if (invalid_urls.length > 0) {
                                alert(`The following URLs are invalid: \n${invalid_urls.join("\n")}`);
                                return;
                            }

                            if (appn=="") {
                                return;
                            }

                            console.log(appn, appdesc);

                            createApp(appn, appdesc, ["VCSI"], appurls);
                        }
                    }
                }
            ]);
            ev.preventDefault();
        },
        "ctrl+alt+x": async ()=>{
            var r = await getTags();
            console.log(r);
        }
    };

    var lsht="";
    window.addEventListener("keyup", ()=>{
        lsht="";
    });

    window.addEventListener("keydown", (e) => {
        const code = e.code;
        const key = (code == "Space" ? "space" : e.key.toLowerCase());

        var sht = "";
        if (e.ctrlKey) {
            sht += "ctrl";
        }
        if (e.altKey) {
            if (sht != "") {
                sht += "+";
            }
            sht += "alt";
        }
        if (e.shiftKey) {
            if (sht != "") {
                sht += "+";
            }
            sht += "shift";
        }

        if (!["control", "alt", "shift"].includes(key)) {
            if (sht != "") {
                sht += "+";
            }
            sht += key;
        }
        if (sht==lsht) {
            return;
        }
        lsht=sht;

        console.log(sht);

        if (Object.keys(shortcuts).includes(sht)) {
            const ex = shortcuts[sht];
            ex(e);
        }
    });

    window.addEventListener("click", (ev)=>{
        const tg = ev.target;
        if (["div.modal__close, div.modal__close *", "div.modal__overlay"].some((slt)=> Array.from(document.querySelectorAll(slt)).some((el)=> el==tg))) {
            while (modalPortal.firstChild) {
                modalPortal.lastChild.remove();
            }
        }
    });


})();
