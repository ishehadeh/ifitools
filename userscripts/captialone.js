// ==UserScript==
// @name     Capital One to Ledger
// @version  1
// @include  https://myaccounts.capitalone.com/*
// @grant  GM.registerMenuCommand
// @grant    GM.openInTab
// ==/UserScript==

// source: https://bobbyhadz.com/blog/javascript-wait-for-element-to-exist
function waitForElementToExist(selector) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        subtree: true,
        childList: true,
      });
    });
  }

  /**
   * @returns {IterableIterator<Element>}
   */
  function getTransactionTables() {
    return document.querySelectorAll(".c1-ease-card-transactions-view__table")
      .values();
  }

  /** Get the title of transaction table from one of wrapper elements returned by `getTransactionTables`
   *
   * @param {HTMLElement} tbl
   *
   * @returns {string}
   * @see getTransactionTables
   */
  function getTransactionTableName(tbl) {
    const titleElem = tbl.querySelector(
      ".c1-ease-card-transactions-view__table--headersection-title",
    );
    const titleSpans = titleElem.getElementsByTagName("span");
    // some tables have icons within the headersection-title element.
    // So extract the first span containing the text title
    if (titleSpans[0]) return titleSpans[0].textContent.trim();
    return titleElem.textContent.trim();
  }

  /** Get a series of transaction wrapper elements from a table wrapper element
   *
   * @param {Element} tbl
   *
   * @returns {IterableIterator<Element>}
   * @see getTransactionTables
   */
  function getTransactionElementsFromTable(tbl) {
    return tbl.querySelectorAll(".c1-ease-table__body c1-ease-row").values();
  }

  /**
   * Information about a payment
   * @typedef {Object} C1Payment
   * @property {string} source
   * @property {string} method
   * @property {string} confirmationCode
   */

  /** Information about a business's adress and phone
   * @typedef {Object} C1AddressInfo
   * @property {string?} street
   * @property {string} address
   * @property {string} phone
   */

  /**
   * Information from a transaction drawer element
   * @typedef {Object} C1Transaction
   * @property {string} description
   * @property {string} category
   * @property {string} card
   * @property {string} amount
   * @property {C1AddressInfo?} address
   * @property {C1Payment?} paymentInfo
   * @property {Date?} date
   * @property {Date?} datePosted
   * @property {string} descriptionOnStatement
   */

  /**
   * @param {HTMLElement} txnElem
   *
   * @returns {Object}
   */
  function getTransactionDrawerMetadata(txnElem) {
    const rowElems = txnElem.querySelectorAll(
      "div:is(.c1-ease-card-transactions-view-table-drawer-details__row,.c1-ease-card-transactions-view-table-drawer-payments-details__row)",
    ).values();
    const rowInfos = {};
    const arr = [...rowElems];
    for (const rowElem of arr) {
      const [col1, col2] = rowElem.querySelectorAll("div > span").values();
      const name = col1.textContent.replace(":", "").trim();
      const value = col2.textContent.trim();
      if (name) {
        rowInfos[name] = value;
      }
    }

    return rowInfos;
  }

  /**
   * @param {HTMLElement} txnElem
   *
   * @returns {C1Transaction}
   */
  async function getTransactionElementDetails(txnElem) {
    // expand the drawer
    txnElem.click();

    await waitForElementToExist(".c1-ease-txns-drawer__row");

    const description = txnElem.querySelector(
      "div.c1-ease-txns-description__description",
    ).textContent.trim();
    const category = txnElem.querySelector("c1-ease-cell.c1-ease-column-category")
      .textContent.trim();
    const card = txnElem.querySelector("c1-ease-cell.c1-ease-column-card")
      .textContent.trim();
    const amount = txnElem.querySelector(
      "c1-ease-cell.c1-ease-column-amount > span:nth-of-type(1)",
    ).textContent.trim();

    const metadata = getTransactionDrawerMetadata(txnElem);
    let address;
    let datePosted = "Posted" in metadata
      ? new Date(metadata["Posted"])
      : undefined;
    if (datePosted !== undefined && !isFinite(datePosted)) {
      throw new Error(
        `In transaction '${description}': Invalid 'Posted' date '${
          metadata["Posted"]
        }'`,
      );
    }

    let date = "Purchased" in metadata
      ? new Date(metadata["Purchased"])
      : datePosted;
    if (date !== undefined && !isFinite(date)) {
      throw new Error(
        `In transaction '${description}': Invalid 'Purchased' date '${
          metadata["Purchased"]
        }'`,
      );
    }
    let paymentInfo;
    let descriptionOnStatement = description;
    if (category !== "Payment") {
      const addressElem = txnElem.querySelector(
        ".c1-ease-card-transactions-view-table-drawer-details__address",
      );
      if (addressElem) {
        const [streetElem, addressLine2Elem, phoneElem] = addressElem.childNodes;
        const street = streetElem.textContent?.trim();
        const addressLine2 = addressLine2Elem.textContent?.trim();
        const phone = phoneElem.textContent?.trim();
        address = { street, address: addressLine2, phone };
      }
      descriptionOnStatement = txnElem.querySelectorAll(
        "div.c1-ease-card-transactions-view-table-drawer-details__statements span",
      )[1]?.textContent?.trim();
    } else {
      paymentInfo = {
        source: metadata["Source"],
        method: metadata["Method"],
        confirmationCode: metadata["Confirmation Code"],
      };
    }

    return {
      description,
      category,
      card,
      amount,
      address,
      date,
      datePosted,
      descriptionOnStatement,
      paymentInfo,
    };
  }

  /**
   * @param {HTMLElement} tableElem
   *
   * @returns {Array<C1Transaction>}
   */
  async function getTransactionsFromTable(tableElem) {
    const txns = [];
    for (const txnElem of getTransactionElementsFromTable(tableElem)) {
      txns.push(await getTransactionElementDetails(txnElem));
    }

    return txns;
  }

  /**
   * @param {string} tableName
   *
   * @returns {Array<C1Transaction>}
   */
  async function getTransactionsFromTableByName(tableName) {
    const tableNames = [];
    for (const table of getTransactionTables()) {
      if (getTransactionTableName(table) == tableName) {
        return await getTransactionsFromTable(table);
      }
      tableNames.push(getTransactionTableName(table));
    }

    throw new Error(
      `No table found with name "${tableName}", found: "${
        tableNames.join('" "')
      }"`,
    );
  }

  /**
   * @param {Date} date
   * @returns {string}
   */
  function isoSecAndTZ(date) {
    const localTzTotalSec = date.getTimezoneOffset();
    const localTzMin = Math.floor(Math.abs(localTzTotalSec) / 60);
    const localTzSec = Math.abs(localTzTotalSec) - localTzMin * 60;

    const utc = new Date(date.getTime() - localTzTotalSec * 60000);
    const sign = localTzTotalSec < 0 ? "+" : "-";
    return utc.toISOString().replace(/\.\d{3}.*$/, "") + sign +
      localTzMin.toFixed(0).padStart(2, "0") + ":" +
      localTzSec.toFixed(0).padStart(2, "0");
  }

  function normAmount(amt) {
    const strippedAmount = amt.split("$")[1];
    return strippedAmount.replace(/0+$/g, "").replace(/\.$/g, ".0");
  }

  /**
   * @param {C1Transaction} txn
   * @returns {string}
   */
  function c1TransactionToIFX(txn) {
    let date = isoSecAndTZ(txn.datePosted ?? txn.date ?? new Date());
    const ext = {
      description: txn.description,
    };
    if (txn.datePosted && txn.date != txn.datePosted) {
      // add date2 as the purchase date, if that isn't the same as date1
      ext["datePurchased"] = isoSecAndTZ(txn.date);
    }

    if (txn.address) {
      const [city, stateZipCountry] = txn.address.address.split(",");
      const normPhone = txn.address.phone.replace(/[^0-9]/ig, "");
      const [state, zip, _country] = stateZipCountry.trim().split(" ");
      // for my needs country is always US (as of 2023-06)
      const address = { state, zip };
      if (txn.address.street) {
        address.street = txn.address.street ?? null;
      }
      if (city.replace(/[^0-9]/ig, "") != normPhone) {
        // sometimes a mangled phone number ends up in the city field.
        address.city = city ?? null;
      }
      ext["address"] = address;
    }
    strippedAmount = normAmount(txn.amount);

    const cardSuffix = txn.card.replace(/^.*\.\.\./, "");
    const amountSign = txn.paymentInfo ? "+" : "-";
    return {
      date,
      account: cardSuffix,
      amount: amountSign + strippedAmount,
      ext,
      status: "UNKNOWN",
      commodity: "USD",
    };
  }

  waitForElementToExist("div.c1-ease-account-hero__tertiary-content.ng-star-inserted c1-ease-account-details-top-right-grid-cell")
    .then((el) => {
      el.innerHTML += `<button id="ledger-copy" class="c1-ease-account-details-top-right-grid-cell__payment-button c1-ease-button c1-ease-button--ghost ng-star-inserted"> Copy Ledger Transactions</button>`
      document.getElementById("ledger-copy").onclick = doCopy
    })

  async function doCopy() {
        const pendingTxns = await getTransactionsFromTableByName(
        "Pending Transactions",
      );
      const recentPostedTxns = await getTransactionsFromTableByName(
        "Posted Transactions Since Your Last Statement",
      );
      const allTxns = pendingTxns.concat(recentPostedTxns).sort((x) =>
        x.date ?? new Date()
      );
      const ledgerJournal = allTxns.map((t) =>
        JSON.stringify(c1TransactionToIFX(t))
      ).join("\n");
      try {
      console.log(ledgerJournal);
      await navigator.clipboard.writeText(ledgerJournal);
      alert("transaction copied");
    } catch (e) {
      console.error(e);
      // alert(e);
      GM.openInTab(URL.createObjectURL(new Blob([ledgerJournal]), '_blank')).focus();
    }
  }

  GM.registerMenuCommand("Copy Ledger Transaction", async () => {
    await doCopy()
  });
