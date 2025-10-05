// public/ventas.js
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const ui = {
  // listado
  tbodyVentas: $("#tbl-ventas tbody"),
  ventasCount: $("#ventasCount"),
  btnNueva: $("#btnNuevaVenta"),
  buscarVentas: $("#buscarVentas"),

  // nueva venta
  boxNueva: $("#boxNuevaVenta"),
  frmVenta: $("#frmVenta"),
  btnCancelarVenta: $("#btnCancelarVenta"),
  tblItemsBody: $("#tbl-items tbody"),
  tblCuotasBody: $("#tbl-det-cuotas tbody"),
  btnAddItem: $("#btnAddItem"),

  sumItems: $("#sumItems"),
  sumInteres: $("#sumInteres"),
  sumTotalConInteres: $("#sumTotalConInteres"),
  sumCuotas: $("#sumCuotas"),

  // detalle
  boxDetalle: $("#boxDetalle"),
  ventaCab: $("#ventaCab"),
  detItemsBody: $("#tbl-det-items tbody"),
  detCuotasBody: $("#tbl-det-cuotas tbody"),

  // pago
  boxPago: $("#boxPago"),
  frmPago: $("#frmPago"),
};

const state = {
  ventas: [],
  clientes: [],
  productos: [],
  filter: "",
  // formularios
  itemsForm: [],
  cuotasForm: [],
  detalleVentaId: null,
};

// ==================== Utils ====================
function text(t) {
  return document.createTextNode(String(t ?? ""));
}
function cell(t) {
  const td = document.createElement("td");
  td.textContent = String(t ?? "");
  return td;
}
function btn(label, cls, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function toInputDate(v) {
  const d = v ? new Date(v) : new Date();
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  d.setMonth(d.getMonth() + months);
  return toInputDate(d);
}
function sum(arr, sel = (x) => x) {
  return arr.reduce((acc, it) => acc + (Number(sel(it)) || 0), 0);
}
function debounce(fn, t = 250) {
  let h;
  return (...a) => {
    clearTimeout(h);
    h = setTimeout(() => fn(...a), t);
  };
}
function formatDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d)) return d.toLocaleDateString("es-AR");
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

// ==================== Carga base ====================
async function loadBase() {
  const [clientes, productos, ventas] = await Promise.all([
    fetch("/api/clientes").then((r) => (r.ok ? r.json() : [])),
    fetch("/api/productos").then((r) => (r.ok ? r.json() : [])),
    fetch("/api/ventas").then((r) => (r.ok ? r.json() : [])),
  ]);
  state.clientes = Array.isArray(clientes) ? clientes : [];
  state.productos = Array.isArray(productos) ? productos : [];
  state.ventas = Array.isArray(ventas) ? ventas : [];
}

// ==================== Listado ====================
function renderListado() {
  ui.tbodyVentas.innerHTML = "";
  const q = (state.filter || "").trim().toLowerCase();

  const filtered = !q
    ? state.ventas
    : state.ventas.filter((v) => {
        const cliente = (v.cliente || "").toLowerCase();
        const tipo = (v.tipoPago || "").toLowerCase();
        return (
          cliente.includes(q) || tipo.includes(q) || String(v.id).includes(q)
        );
      });

  filtered.forEach((v) => {
    const tr = document.createElement("tr");
    tr.append(cell(v.id));
    tr.append(cell(formatDate(v.fecha)));
    tr.append(cell(v.cliente || ""));
    tr.append(cell(v.tipoPago));
    tr.append(cell(money(v.total)));
    tr.append(cell(money(v.saldo)));
    tr.append(cell(`${Number(v.interes || 0).toFixed(2)}%`));

    const acc = document.createElement("td");
    acc.style.whiteSpace = "nowrap";
    const bDet = btn("Detalle", "btn btn-sm", () => openDetalle(v.id));
    acc.append(bDet);

    if (puedeRegistrarPago(v)) {
      acc.append(text(" "));
      const bPay = btn("Registrar pago", "btn btn-sm", () => openPago(v.id));
      acc.append(bPay);
    }
    tr.append(acc);

    ui.tbodyVentas.append(tr);
  });
  ui.ventasCount.textContent = `${filtered.length} venta(s)`;
}
function puedeRegistrarPago(v) {
  const credito = String(v.tipoPago || "").toLowerCase() === "credito";
  const saldo = Number(v.saldo || 0) > 0;
  return credito && saldo;
}

// ==================== Nueva venta ====================
ui.btnNueva?.addEventListener("click", openNueva);
ui.btnCancelarVenta?.addEventListener("click", closeNueva);
ui.btnAddItem?.addEventListener("click", addItemRow);

function openNueva() {
  // limpia form
  ui.tblItemsBody.innerHTML = "";
  ui.tblCuotasBody.innerHTML = "";
  state.itemsForm = [];
  state.cuotasForm = [];

  // fecha default
  ui.frmVenta.fecha.value = toInputDate(new Date());

  // clientes
  const selCliente = ui.frmVenta.clienteId;
  selCliente.innerHTML =
    `<option value="">Elegir...</option>` +
    state.clientes
      .map(
        (c) =>
          `<option value="${c.id}">${
            (c.apellido ? c.apellido + ", " : "") + (c.nombre || "")
          }</option>`
      )
      .join("");

  // valores por defecto
  ui.frmVenta.tipoPago.value = "Contado";
  ui.frmVenta.interes.value = "0";
  ui.frmVenta.cantCuotas.value = "1";
  ui.frmVenta.primerVencimiento.value = toInputDate(new Date());

  // muestra/oculta bloque de cuotas
  toggleBloqueCuotas();

  // primera fila
  addItemRow();

  ui.boxNueva.style.display = "block";
  ui.boxNueva.scrollIntoView({ behavior: "smooth", block: "start" });
}
function closeNueva() {
  ui.boxNueva.style.display = "none";
}

function addItemRow() {
  const rowId = crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

  const tr = document.createElement("tr");
  tr.dataset.rowid = rowId;

  const idxTd = cell(($$("#tbl-items tbody tr").length + 1).toString());

  // === Producto
  const tdProd = document.createElement("td");
  const sel = document.createElement("select");
  sel.innerHTML =
    `<option value="">Elegir producto...</option>` +
    state.productos
      .map(
        (p) =>
          `<option value="${p.id}" data-precio="${p.precio}" data-stock="${
            p.cantidad || 0
          }">
            ${p.nombre} (${p.marca || ""})
          </option>`
      )
      .join("");

  const stockNote = document.createElement("div");
  stockNote.className = "note";
  stockNote.textContent = "";

  // mini ficha del producto
  const detailNote = document.createElement("div");
  detailNote.className = "note";
  detailNote.style.opacity = "0.9";
  detailNote.style.fontSize = "12px";
  detailNote.style.marginTop = "4px";
  detailNote.textContent = "";

  tdProd.append(sel, stockNote, detailNote);

  // === Cantidad
  const tdCant = document.createElement("td");
  const inpCant = document.createElement("input");
  inpCant.type = "number";
  inpCant.min = "1";
  inpCant.step = "1";
  inpCant.value = "1";
  tdCant.append(inpCant);

  // === Precio unitario
  const tdPrecio = document.createElement("td");
  const inpPrecio = document.createElement("input");
  inpPrecio.type = "number";
  inpPrecio.min = "0";
  inpPrecio.step = "0.01";
  inpPrecio.value = "0";
  tdPrecio.append(inpPrecio);

  // === Subtotal y eliminar
  const tdSub = document.createElement("td");
  tdSub.textContent = money(0);

  const tdDel = document.createElement("td");
  const bDel = btn("X", "btn btn-sm btn-danger", () => {
    tr.remove();
    state.itemsForm = state.itemsForm.filter((r) => r.id !== rowId);
    renumerarItems();
    recalcItems();
  });
  tdDel.append(bDel);

  // ==== helpers de la fila
  function currentStock() {
    const opt = sel.options[sel.selectedIndex];
    return Number(opt?.dataset?.stock || 0);
  }
  function validateQtyVsStock() {
    const stock = currentStock();
    const qty = Number(inpCant.value || 0);
    if (stock >= 0 && qty > stock) {
      inpCant.classList.add("input-bad");
      stockNote.classList.add("bad");
      if (!stockNote.textContent.includes("•")) {
        stockNote.textContent += " • Cantidad supera el stock";
      }
    } else {
      inpCant.classList.remove("input-bad");
      // restaurar texto base
      const st = currentStock();
      if (st <= 0) {
        stockNote.textContent = "SIN STOCK";
        stockNote.classList.add("bad");
      } else {
        stockNote.textContent = `Stock: ${st}`;
        stockNote.classList.remove("bad");
        stockNote.classList.add("good");
      }
    }
  }
  function syncRow() {
    const productoId = Number(sel.value) || null;
    const cantidad = Number(inpCant.value) || 0;
    const precioUnit = Number(inpPrecio.value) || 0;
    const subtotal = cantidad * precioUnit;
    tdSub.textContent = money(subtotal);

    const idx = state.itemsForm.findIndex((x) => x.id === rowId);
    const row = { id: rowId, productoId, cantidad, precioUnit };
    if (idx === -1) state.itemsForm.push(row);
    else state.itemsForm[idx] = row;
  }

  // === event handlers (un solo onchange)
  sel.onchange = () => {
    const opt = sel.options[sel.selectedIndex];
    const precioSugerido = Number(opt?.dataset?.precio || 0);
    const stock = Number(opt?.dataset?.stock || 0);

    if (!isNaN(precioSugerido) && precioSugerido > 0) {
      inpPrecio.value = precioSugerido.toFixed(2);
    }

    // stock
    if (stock <= 0) {
      stockNote.textContent = "SIN STOCK";
      stockNote.classList.remove("good");
      stockNote.classList.add("bad");
      stockNote.style.color = "#b71c1c";
    } else {
      stockNote.textContent = `Stock: ${stock}`;
      stockNote.classList.remove("bad");
      stockNote.classList.add("good");
      stockNote.style.color = "#1b5e20";
    }

    // detalle
    const pid = Number(sel.value);
    const p = state.productos.find((x) => x.id === pid);
    if (p) {
      const venceTxt = p.vencimiento
        ? ` • Vence: ${
            typeof formatDate === "function"
              ? formatDate(p.vencimiento)
              : p.vencimiento
          }`
        : "";
      detailNote.innerHTML = `<strong>${p.marca || "-"}</strong> — ${
        p.detalle || "Sin detalle"
      }${venceTxt} • Precio sug.: ${
        typeof money === "function"
          ? money(p.precio)
          : "$ " + Number(p.precio || 0).toFixed(2)
      }`;
    } else {
      detailNote.textContent = "";
    }

    validateQtyVsStock();
    syncRow();
    recalcItems();
  };

  inpCant.oninput = () => {
    validateQtyVsStock();
    syncRow();
    recalcItems();
  };
  inpPrecio.oninput = () => {
    syncRow();
    recalcItems();
  };

  // montar fila
  tr.append(idxTd, tdProd, tdCant, tdPrecio, tdSub, tdDel);
  ui.tblItemsBody.append(tr);

  // disparar inicial
  sel.dispatchEvent(new Event("change"));
  inpCant.dispatchEvent(new Event("input"));
}

// renumera filas al borrar
function renumerarItems() {
  $$("#tbl-items tbody tr").forEach(
    (tr, i) => (tr.firstChild.textContent = i + 1)
  );
}

// recálculos y cuotas
function toggleBloqueCuotas() {
  const tipo = ui.frmVenta.tipoPago.value;
  const show = tipo === "Credito";
  $("#bloqueCuotas").style.display = show ? "" : "none";
}
ui.frmVenta?.tipoPago.addEventListener("change", () => {
  toggleBloqueCuotas();
  recalcItems();
});

ui.frmVenta?.interes.addEventListener("input", () => {
  recalcItems();
});
ui.frmVenta?.cantCuotas.addEventListener("input", () => {
  if (ui.frmVenta.tipoPago.value !== "Credito") return;
  const n = Math.max(1, Number(ui.frmVenta.cantCuotas.value || 1));

  const totalItems = sum(
    state.itemsForm,
    (r) => (r.cantidad || 0) * (r.precioUnit || 0)
  );
  const interes = Number(ui.frmVenta.interes.value || 0);
  const totalConInteres = +(totalItems + (totalItems * interes) / 100).toFixed(
    2
  );

  let primerVto =
    ui.frmVenta.primerVencimiento.value || toInputDate(new Date());
  const base = +(totalConInteres / n).toFixed(2);
  let rem = +(totalConInteres - base * (n - 1)).toFixed(2);

  state.cuotasForm = [];
  ui.tblCuotasBody.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const nro = i + 1;
    const vto = i === 0 ? primerVto : addMonths(primerVto, i);
    const monto = i === n - 1 ? rem : base;
    pushCuotaRow({ nro, venceEl: vto, monto });
  }
  recalcItems();
});

function pushCuotaRow(c) {
  state.cuotasForm.push({
    nro: Number(c.nro) || 1,
    venceEl: c.venceEl,
    monto: Number(c.monto) || 0,
  });

  const tr = document.createElement("tr");
  const tdNro = cell(c.nro);
  const tdVto = document.createElement("td");
  const vto = document.createElement("input");
  vto.type = "date";
  vto.value = c.venceEl || toInputDate(new Date());
  vto.oninput = () => {
    const i = state.cuotasForm.findIndex((x) => x.nro === c.nro);
    if (i !== -1) state.cuotasForm[i].venceEl = vto.value;
  };
  tdVto.append(vto);

  const tdMonto = document.createElement("td");
  const m = document.createElement("input");
  m.type = "number";
  m.min = "0";
  m.step = "0.01";
  m.value = String(c.monto || 0);
  m.oninput = () => {
    const i = state.cuotasForm.findIndex((x) => x.nro === c.nro);
    if (i !== -1) state.cuotasForm[i].monto = Number(m.value || 0);
    recalcItems();
  };
  tdMonto.append(m);

  const tdDel = document.createElement("td");
  const bDel = btn("X", "btn btn-sm btn-danger", () => {
    const i = state.cuotasForm.findIndex((x) => x.nro === c.nro);
    if (i !== -1) state.cuotasForm.splice(i, 1);
    tr.remove();
    recalcItems();
  });
  tdDel.append(bDel);

  tr.append(tdNro, tdVto, tdMonto, tdDel);
  ui.tblCuotasBody.append(tr);
}

function recalcItems() {
  const totalItems = sum(
    state.itemsForm,
    (r) => (r.cantidad || 0) * (r.precioUnit || 0)
  );
  ui.sumItems.textContent = money(totalItems);

  const tipo = ui.frmVenta.tipoPago.value;
  const interesPct = Number(ui.frmVenta.interes.value || 0);
  if (tipo === "Credito") {
    const tci = +(totalItems + (totalItems * interesPct) / 100).toFixed(2);
    ui.sumInteres.textContent = `Interés: ${interesPct.toFixed(2)}%`;
    ui.sumTotalConInteres.textContent = `Total con interés: ${money(tci)}`;

    const totalCuotas = sum(state.cuotasForm, (c) => c.monto || 0);
    ui.sumCuotas.textContent = money(totalCuotas);
  } else {
    ui.sumInteres.textContent = "";
    ui.sumTotalConInteres.textContent = "";
    ui.sumCuotas.textContent = money(0);
  }
}

// submit nueva venta
ui.frmVenta?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ui.frmVenta.elements;

  const payload = {
    fecha: f.fecha.value || toInputDate(new Date()),
    clienteId: Number(f.clienteId.value),
    tipoPago: f.tipoPago.value,
    interes: Number(f.interes?.value || 0),
    items: state.itemsForm
      .filter((r) => r.productoId && r.cantidad > 0)
      .map((r) => ({
        productoId: r.productoId,
        cantidad: r.cantidad,
        precioUnit: r.precioUnit,
      })),
    cuotas:
      f.tipoPago.value === "Credito"
        ? state.cuotasForm.map((c) => ({
            nro: c.nro,
            venceEl: c.venceEl,
            monto: c.monto,
          }))
        : [],
  };

  try {
    const r = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      alert("No se pudo guardar la venta: " + t);
      return;
    }
    ui.boxNueva.style.display = "none";
    await refreshVentas();
  } catch (e) {
    console.error(e);
    alert("Error de red guardando la venta");
  }
});

// ==================== Detalle ====================
async function openDetalle(id) {
  state.detalleVentaId = id;
  ui.boxDetalle.style.display = "block";

  try {
    const r = await fetch(`/api/ventas/${id}`);
    if (!r.ok) {
      const t = await r.text();
      console.error("GET /api/ventas/:id", r.status, t);
      alert("No se pudo cargar la venta");
      return;
    }
    const det = await r.json();

    // cabecera
    const v = det.venta;
    ui.ventaCab.innerHTML = `
      <div><strong>Venta #${v.id}</strong> — ${formatDate(v.fecha)} — ${
      v.tipoPago
    }
      — Total: ${money(v.total)} — Saldo: ${money(v.saldo)} — Interés: ${Number(
      v.interes || 0
    ).toFixed(2)}%</div>
      <div>Cliente: ${
        (v.apellido ? v.apellido + ", " : "") + (v.nombre || "")
      } (ID ${v.clienteId})</div>
    `;

    // items
    ui.detItemsBody.innerHTML = "";
    det.items.forEach((it, i) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(i + 1),
        cell(it.producto),
        cell(it.cantidad),
        cell(money(it.precioUnit))
      );
      ui.detItemsBody.append(tr);
    });

    // cuotas
    ui.detCuotasBody.innerHTML = "";
    det.cuotas.forEach((c) => {
      const tr = document.createElement("tr");
      const saldo = Number(c.saldo || 0);
      tr.append(
        cell(c.nro),
        cell(formatDate(c.venceEl)),
        cell(money(c.monto)),
        cell(money(c.pagado)),
        cell(money(c.saldo))
      );
      ui.detCuotasBody.append(tr);
    });
  } catch (e) {
    console.error(e);
    alert("Error de red cargando detalle");
  }
}

// ==================== Pago ====================
function openPago(ventaId) {
  ui.boxPago.style.display = "block";
  ui.frmPago.ventaId.value = String(ventaId || "");
  ui.frmPago.fecha.value = toInputDate(new Date());
}
ui.frmPago?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const b = ui.frmPago.elements;

  const payload = {
    ventaId: Number(b.ventaId.value),
    fecha: b.fecha.value || toInputDate(new Date()),
    monto: Number(b.monto.value || 0),
  };

  try {
    const r = await fetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      alert("No se pudo registrar el pago: " + t);
      return;
    }
    ui.boxPago.style.display = "none";
    await refreshVentas();
    if (state.detalleVentaId) {
      openDetalle(state.detalleVentaId);
    }
  } catch (e) {
    console.error(e);
    alert("Error de red aplicando pago");
  }
});

// ==================== Helpers globales ====================
async function refreshVentas() {
  const ventas = await fetch("/api/ventas").then((r) => (r.ok ? r.json() : []));
  state.ventas = Array.isArray(ventas) ? ventas : [];
  renderListado();
}

// ==================== Eventos globales ====================
ui.buscarVentas?.addEventListener(
  "input",
  debounce(() => {
    state.filter = ui.buscarVentas.value || "";
    renderListado();
  }, 200)
);

document.addEventListener("DOMContentLoaded", async () => {
  await loadBase();
  renderListado();
});
