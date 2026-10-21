(function () {
  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const value = button.getAttribute("data-copy") || "";
    const done = button.getAttribute("data-copied") || "Copied";
    const label = button.querySelector("[data-label]");
    const previous = label ? label.textContent : "";
    navigator.clipboard.writeText(value).then(function () {
      if (!label) return;
      label.textContent = done;
      setTimeout(function () { label.textContent = previous; }, 1200);
    });
  });

  function bindUpload(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = "1";
    const input = root.querySelector(".file-upload-input");
    const grid = root.querySelector("[data-grid]");
    const drop = root.querySelector("[data-drop]");
    const order = root.querySelector("[data-order]");
    const multiple = root.hasAttribute("data-multiple");

    function isFileDrag(event) {
      return event.dataTransfer && [...event.dataTransfer.types].includes("Files");
    }

    function writeOrder() {
      const items = [...grid.querySelectorAll(".file-upload-item")];
      order.value = JSON.stringify(items.map((item) => item.dataset.token));
      const transfer = new DataTransfer();
      for (const item of items) {
        if (item._file) transfer.items.add(item._file);
      }
      input.files = transfer.files;
    }

    function removeButton() {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-upload-remove";
      button.dataset.remove = "";
      button.setAttribute("aria-label", root.dataset.removeLabel || "Remove file");
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      return button;
    }

    function addFiles(list) {
      const incoming = [...list].filter((file) => file.type.startsWith("image/"));
      if (!incoming.length) return;
      if (!multiple) {
        for (const item of grid.querySelectorAll(".file-upload-item")) {
          if (item.querySelector("img")?.src.startsWith("blob:")) URL.revokeObjectURL(item.querySelector("img").src);
          item.remove();
        }
      }
      for (const file of incoming) {
        const item = document.createElement("figure");
        item.className = "file-upload-item";
        item.dataset.token = "new";
        item._file = file;
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "";
        img.draggable = false;
        item.append(img, removeButton());
        grid.insertBefore(item, drop);
        if (!multiple) break;
      }
      writeOrder();
    }

    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      addFiles(input.files);
    });

    function over(event) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      drop.classList.add("is-dragover");
    }
    root.addEventListener("dragenter", over);
    root.addEventListener("dragover", over);
    root.addEventListener("dragleave", (event) => {
      if (!root.contains(event.relatedTarget)) drop.classList.remove("is-dragover");
    });
    root.addEventListener("drop", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      drop.classList.remove("is-dragover");
      addFiles(event.dataTransfer.files);
    });
    root.addEventListener("paste", (event) => {
      const files = event.clipboardData && event.clipboardData.files;
      if (!files || !files.length) return;
      event.preventDefault();
      addFiles(files);
    });

    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button || !root.contains(button)) return;
      const item = button.closest(".file-upload-item");
      if (!item) return;
      const img = item.querySelector("img");
      if (img && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      item.remove();
      writeOrder();
    });

    if (multiple) {
      let active = null;
      let originX = 0;
      let originY = 0;
      let moved = false;

      function place(x, y) {
        active.style.pointerEvents = "none";
        const under = document.elementFromPoint(x, y);
        active.style.pointerEvents = "";
        if (!under) return;
        if (under === drop || drop.contains(under)) {
          if (active.nextSibling !== drop) grid.insertBefore(active, drop);
          return;
        }
        const target = under.closest(".file-upload-item");
        if (!target || target === active || !grid.contains(target)) return;
        const box = target.getBoundingClientRect();
        const rtl = getComputedStyle(grid).direction === "rtl";
        const before = rtl ? x > box.left + box.width / 2 : x < box.left + box.width / 2;
        if (before) {
          if (active.nextSibling !== target) grid.insertBefore(active, target);
        } else if (active.previousSibling !== target) {
          grid.insertBefore(active, target.nextSibling);
        }
      }

      grid.addEventListener("pointerdown", (event) => {
        const item = event.target.closest(".file-upload-item");
        if (!item || event.button !== 0 || event.target.closest("[data-remove]")) return;
        active = item;
        originX = event.clientX;
        originY = event.clientY;
        moved = false;
        item.setPointerCapture(event.pointerId);
      });
      grid.addEventListener("pointermove", (event) => {
        if (!active || !active.hasPointerCapture(event.pointerId)) return;
        if (!moved && Math.hypot(event.clientX - originX, event.clientY - originY) < 5) return;
        moved = true;
        active.classList.add("is-dragging");
        place(event.clientX, event.clientY);
      });
      function endDrag(event) {
        if (!active) return;
        if (event && active.hasPointerCapture(event.pointerId)) active.releasePointerCapture(event.pointerId);
        active.classList.remove("is-dragging");
        if (moved) writeOrder();
        active = null;
      }
      grid.addEventListener("pointerup", endDrag);
      grid.addEventListener("pointercancel", endDrag);
    }

    const form = root.closest("form");
    if (form) form.addEventListener("submit", writeOrder);
    writeOrder();
  }

  function bindSelect(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = "1";
    const native = root.querySelector("select");
    const control = root.querySelector(".select-control");
    if (!native || !control) return;
    native.tabIndex = -1;
    native.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const labelledBy = native.getAttribute("aria-labelledby");
    if (labelledBy) {
      trigger.setAttribute("aria-labelledby", labelledBy + " select-" + native.name + "-value");
    }

    const valueEl = document.createElement("span");
    valueEl.className = "select-value";
    valueEl.id = "select-" + native.name + "-value";
    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevron.setAttribute("viewBox", "0 0 24 24");
    chevron.setAttribute("class", "select-chevron");
    chevron.setAttribute("aria-hidden", "true");
    const chevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chevronPath.setAttribute("d", "m6 9 6 6 6-6");
    chevronPath.setAttribute("fill", "none");
    chevronPath.setAttribute("stroke", "currentColor");
    chevronPath.setAttribute("stroke-width", "2");
    chevronPath.setAttribute("stroke-linecap", "round");
    chevronPath.setAttribute("stroke-linejoin", "round");
    chevron.append(chevronPath);

    const menu = document.createElement("div");
    menu.className = "select-menu";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    if (labelledBy) menu.setAttribute("aria-labelledby", labelledBy);

    trigger.append(valueEl, chevron);
    control.append(trigger, menu);
    root.classList.add("is-ready");

    function paint() {
      const option = native.selectedOptions[0];
      const text = option ? option.textContent.trim() : "";
      const placeholder = native.dataset.placeholder || "";
      const showingPlaceholder = !native.value && placeholder !== "" && (text === "" || text === placeholder);
      valueEl.textContent = text || placeholder;
      valueEl.classList.toggle("is-placeholder", showingPlaceholder);
    }

    function close() {
      menu.hidden = true;
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function render() {
      menu.replaceChildren();
      for (const option of native.options) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "select-option";
        item.setAttribute("role", "option");
        const text = document.createElement("span");
        text.textContent = option.textContent.trim() || native.dataset.placeholder || "";
        item.append(text);
        if (option.value === native.value) {
          item.setAttribute("aria-selected", "true");
          const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          check.setAttribute("viewBox", "0 0 24 24");
          check.setAttribute("class", "select-check");
          check.setAttribute("aria-hidden", "true");
          const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
          mark.setAttribute("d", "m5 12 5 5L20 7");
          mark.setAttribute("fill", "none");
          mark.setAttribute("stroke", "currentColor");
          mark.setAttribute("stroke-width", "2.2");
          mark.setAttribute("stroke-linecap", "round");
          mark.setAttribute("stroke-linejoin", "round");
          check.append(mark);
          item.append(check);
        }
        item.addEventListener("click", () => commit(option.value));
        menu.append(item);
      }
    }

    function commit(value) {
      const changed = native.value !== value;
      native.value = value;
      if (changed) native.dispatchEvent(new Event("change", { bubbles: true }));
      paint();
      close();
      trigger.focus();
    }

    function open() {
      document.querySelectorAll("[data-select].is-open").forEach((other) => {
        if (other !== root) other.dispatchEvent(new CustomEvent("select:close"));
      });
      document.querySelectorAll("[data-profile].is-open").forEach((other) => other.dispatchEvent(new CustomEvent("profile:close")));
      render();
      menu.hidden = false;
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      const selected = menu.querySelector('[aria-selected="true"]') || menu.querySelector(".select-option");
      if (selected) selected.focus();
    }

    root.addEventListener("select:close", close);
    trigger.addEventListener("click", () => {
      if (root.classList.contains("is-open")) close();
      else open();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    menu.addEventListener("keydown", (event) => {
      const items = [...menu.querySelectorAll(".select-option")];
      const index = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
        items[next]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        document.activeElement?.click();
      } else if (event.key.length === 1) {
        const match = items.find((item) => item.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()));
        match?.focus();
      }
    });
    native.addEventListener("change", paint);
    document.addEventListener("pointerdown", (event) => {
      if (!root.contains(event.target)) close();
    });
    paint();
  }

  function bindProfile(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = "1";
    const trigger = root.querySelector(".who");
    const menu = root.querySelector(".profile-menu");
    if (!trigger || !menu) return;

    function close() {
      menu.hidden = true;
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }
    function open() {
      document.querySelectorAll("[data-select].is-open").forEach((other) => other.dispatchEvent(new CustomEvent("select:close")));
      menu.hidden = false;
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }

    root.addEventListener("profile:close", close);
    trigger.addEventListener("click", () => {
      if (root.classList.contains("is-open")) close();
      else open();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!root.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function bindTable(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = "1";
    const rows = [...root.querySelectorAll("tbody tr")];
    const search = root.querySelector("[data-search]");
    const filters = [...root.querySelectorAll("[data-filter]")];
    const pageSize = root.querySelector("[data-page-size]");
    const meta = root.querySelector("[data-meta]");
    const empty = root.querySelector(".datatable-empty");
    const prev = root.querySelector("[data-prev]");
    const next = root.querySelector("[data-next]");
    const checkAll = root.querySelector("[data-check-all]");
    const bulk = root.querySelector(".datatable-bulk");
    const selectedCount = root.querySelector("[data-selected-count]");
    const columnsButton = root.querySelector("[data-columns]");
    const columnMenu = root.querySelector(".datatable-column-menu");
    const storeKey = "dashboard-table:" + root.dataset.datatable;
    let page = 0;
    let sortKey = "";
    let sortDir = 1;

    function savedHidden() {
      try { return JSON.parse(localStorage.getItem(storeKey) || "[]"); }
      catch (err) { return []; }
    }
    function remember() {
      const hidden = [...root.querySelectorAll("[data-column]")].filter((box) => !box.disabled && !box.checked).map((box) => box.dataset.column);
      try { localStorage.setItem(storeKey, JSON.stringify(hidden)); } catch (err) { /* ignore quota */ }
    }
    function applyColumns() {
      const hidden = new Set([...root.querySelectorAll("[data-column]")].filter((box) => !box.checked).map((box) => box.dataset.column));
      root.querySelectorAll("[data-col]").forEach((cell) => cell.classList.toggle("is-col-off", hidden.has(cell.dataset.col)));
    }
    function cellValue(row, key) {
      const cell = row.querySelector(`[data-col="${CSS.escape(key)}"]`);
      return cell ? (cell.dataset.sort || cell.textContent || "").trim() : "";
    }
    function matchedRows() {
      const query = search.value.trim().toLowerCase();
      return rows.filter((row) => {
        if (query && !row.dataset.search.includes(query)) return false;
        return filters.every((filter) => {
          if (!filter.value) return true;
          const cell = row.querySelector(`[data-col="${CSS.escape(filter.dataset.filter)}"]`);
          return cell && cell.dataset.value === filter.value;
        });
      });
    }
    function paint() {
      const matched = matchedRows();
      const shown = new Set(matched);
      rows.forEach((row) => {
        if (shown.has(row)) return;
        const box = row.querySelector("[data-check]");
        if (box) box.checked = false;
      });
      if (sortKey) {
        matched.sort((a, b) => {
          const av = cellValue(a, sortKey);
          const bv = cellValue(b, sortKey);
          const an = Number(av);
          const bn = Number(bv);
          let result = 0;
          if (av !== "" && bv !== "" && !Number.isNaN(an) && !Number.isNaN(bn)) result = an - bn;
          else result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
          return result * sortDir;
        });
        matched.forEach((row) => row.parentElement.append(row));
      }
      const size = Math.max(1, Number(pageSize.value) || matched.length || 1);
      const pages = Math.max(1, Math.ceil(matched.length / size));
      page = Math.min(page, pages - 1);
      const start = matched.length ? page * size + 1 : 0;
      const end = Math.min(matched.length, (page + 1) * size);
      const visible = new Set(matched.slice(page * size, page * size + size));
      rows.forEach((row) => { row.hidden = !visible.has(row); });
      empty.hidden = matched.length !== 0;
      meta.textContent = matched.length ? `${root.dataset.showing} ${start}–${end} ${root.dataset.of} ${matched.length}` : "";
      prev.disabled = page === 0;
      next.disabled = page >= pages - 1;
      root.querySelectorAll("th[data-sort]").forEach((header) => {
        const mark = header.querySelector(".sort-mark");
        const on = header.dataset.sort === sortKey;
        header.classList.toggle("is-sorted", on);
        if (mark) mark.textContent = on ? (sortDir > 0 ? "↑" : "↓") : "";
      });
      applyColumns();
      paintSelection();
    }
    function boxes(onlyVisible) {
      return rows.filter((row) => !onlyVisible || !row.hidden).map((row) => row.querySelector("[data-check]")).filter(Boolean);
    }
    function paintSelection() {
      const chosen = boxes(false).filter((box) => box.checked);
      if (selectedCount) selectedCount.textContent = `${chosen.length} ${root.dataset.selected}`;
      if (bulk) bulk.hidden = chosen.length === 0;
      if (checkAll) {
        const pageBoxes = boxes(true);
        checkAll.checked = pageBoxes.length > 0 && pageBoxes.every((box) => box.checked);
        checkAll.indeterminate = !checkAll.checked && pageBoxes.some((box) => box.checked);
      }
    }

    const hidden = new Set(savedHidden());
    root.querySelectorAll("[data-column]").forEach((box) => {
      if (!box.disabled && hidden.has(box.dataset.column)) box.checked = false;
      box.addEventListener("change", () => { remember(); applyColumns(); });
    });
    search.addEventListener("input", () => { page = 0; paint(); });
    filters.forEach((filter) => filter.addEventListener("change", () => { page = 0; paint(); }));
    pageSize.addEventListener("change", () => { page = 0; paint(); });
    prev.addEventListener("click", () => { page -= 1; paint(); });
    next.addEventListener("click", () => { page += 1; paint(); });
    root.querySelectorAll("th[data-sort]").forEach((header) => {
      header.addEventListener("click", () => {
        if (sortKey === header.dataset.sort) sortDir *= -1;
        else { sortKey = header.dataset.sort; sortDir = 1; }
        paint();
      });
    });
    if (columnsButton && columnMenu) {
      columnsButton.addEventListener("click", () => {
        columnMenu.hidden = !columnMenu.hidden;
        columnsButton.setAttribute("aria-expanded", String(!columnMenu.hidden));
      });
      document.addEventListener("pointerdown", (event) => {
        if (!columnsButton.contains(event.target) && !columnMenu.contains(event.target)) columnMenu.hidden = true;
      });
    }
    if (checkAll) {
      checkAll.addEventListener("change", () => {
        boxes(true).forEach((box) => { box.checked = checkAll.checked; });
        paintSelection();
      });
    }
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-check]")) paintSelection();
    });
    if (bulk) {
      bulk.addEventListener("submit", (event) => {
        if (!boxes(false).some((box) => box.checked)) event.preventDefault();
        else if (bulk.dataset.confirm && !window.confirm(bulk.dataset.confirm)) event.preventDefault();
      });
    }
    paint();
  }

  function bindPermGroup(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = "1";
    const boxes = [...root.querySelectorAll("[data-perm]")];
    const all = root.querySelector("[data-select-all]");
    if (!all) return;
    function paint() {
      const chosen = boxes.filter((box) => box.checked).length;
      all.checked = boxes.length > 0 && chosen === boxes.length;
      all.indeterminate = chosen > 0 && chosen < boxes.length;
    }
    all.addEventListener("change", () => {
      boxes.forEach((box) => { box.checked = all.checked; });
      paint();
    });
    boxes.forEach((box) => box.addEventListener("change", paint));
    paint();
  }

  function placeActivityTip(tip) {
    const card = tip.querySelector(".activity-tip-card");
    if (!card) return;
    card.classList.add("is-open");
    const anchor = tip.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    let top = anchor.bottom + 6;
    if (top + box.height > window.innerHeight - 8) top = Math.max(8, anchor.top - box.height - 6);
    const rtl = document.documentElement.dir === "rtl";
    let left = rtl ? anchor.right - box.width : anchor.left;
    left = Math.min(Math.max(8, left), window.innerWidth - box.width - 8);
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function closeActivityTips(except) {
    document.querySelectorAll("[data-activity-tip]").forEach((tip) => {
      if (tip === except) return;
      const card = tip.querySelector(".activity-tip-card");
      if (card) card.classList.remove("is-open");
    });
  }

  document.addEventListener("pointerover", (event) => {
    const tip = event.target.closest("[data-activity-tip]");
    if (!tip) return;
    closeActivityTips(tip);
    placeActivityTip(tip);
  });
  document.addEventListener("pointerout", (event) => {
    const tip = event.target.closest("[data-activity-tip]");
    if (!tip || (event.relatedTarget && tip.contains(event.relatedTarget))) return;
    const card = tip.querySelector(".activity-tip-card");
    if (card) card.classList.remove("is-open");
  });
  document.addEventListener("focusin", (event) => {
    const tip = event.target.closest("[data-activity-tip]");
    if (!tip) return;
    closeActivityTips(tip);
    placeActivityTip(tip);
  });
  document.addEventListener("focusout", (event) => {
    const tip = event.target.closest("[data-activity-tip]");
    if (!tip || (event.relatedTarget && tip.contains(event.relatedTarget))) return;
    const card = tip.querySelector(".activity-tip-card");
    if (card) card.classList.remove("is-open");
  });
  document.addEventListener("scroll", () => closeActivityTips(null), true);

  const activityModal = document.createElement("div");
  activityModal.className = "activity-modal";
  activityModal.hidden = true;
  activityModal.innerHTML = '<div class="activity-modal-backdrop" data-activity-close></div><div class="activity-modal-card" role="dialog" aria-modal="true"><header><h2></h2><button type="button" class="ghost" data-activity-close></button></header><div class="activity-modal-body"></div></div>';
  document.body.appendChild(activityModal);
  const activityModalTitle = activityModal.querySelector("h2");
  const activityModalBody = activityModal.querySelector(".activity-modal-body");
  const activityModalClose = activityModal.querySelector(".activity-modal-card [data-activity-close]");

  function closeActivityModal() {
    activityModal.hidden = true;
    activityModalBody.replaceChildren();
  }

  function openActivityModal(button) {
    const tip = button.closest("[data-activity-tip]");
    const card = tip && tip.querySelector(".activity-tip-card");
    if (!card) return;
    closeActivityTips(null);
    activityModalTitle.textContent = button.getAttribute("data-title") || "";
    activityModalClose.textContent = button.getAttribute("data-close") || "Close";
    activityModalClose.setAttribute("aria-label", activityModalClose.textContent);
    activityModalBody.replaceChildren();
    card.querySelectorAll(".activity-tip-side").forEach((side) => {
      activityModalBody.appendChild(side.cloneNode(true));
    });
    activityModal.hidden = false;
    activityModalClose.focus();
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-activity-open]");
    if (open) {
      event.preventDefault();
      openActivityModal(open);
      return;
    }
    if (event.target.closest("[data-activity-close]")) closeActivityModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !activityModal.hidden) closeActivityModal();
  });

  function bindAll() {
    document.querySelectorAll("[data-file-upload]").forEach(bindUpload);
    document.querySelectorAll("[data-select]").forEach(bindSelect);
    document.querySelectorAll("[data-profile]").forEach(bindProfile);
    document.querySelectorAll("[data-datatable]").forEach(bindTable);
    document.querySelectorAll("[data-perm-group]").forEach(bindPermGroup);
  }
  document.addEventListener("DOMContentLoaded", bindAll);
  document.addEventListener("htmx:afterSwap", bindAll);
  bindAll();
})();
