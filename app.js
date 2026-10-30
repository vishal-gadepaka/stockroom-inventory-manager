const state = {
  role: localStorage.getItem('stockroom-role') === 'customer' ? 'customer' : 'admin',
  page: 'overview', data: {}, orderFilter: 'All orders', inventoryFilter: 'All stock',
  productCategory: 'All products', search: '', reportPeriod: '30d',
};

const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  boxes: '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/><path d="m7.5 5 9 4"/>',
  tag: '<path d="M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a.7.7 0 0 1 0 1Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  warehouse: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M8 21v-7h8v7M3 10h18"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  revenue: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
const preciseMoney = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
const number = value => new Intl.NumberFormat('en-US').format(Number(value || 0));
const dateShort = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const dateFull = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const initials = value => String(value || '').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
const get = (key) => state.data[key] || [];
const isAdmin = () => state.role === 'admin';

async function api(path, options = {}) {
  const headers = { 'X-Role': state.role, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

async function refresh(keys = []) {
  const unique = [...new Set(keys)];
  await Promise.all(unique.map(async key => {
    const paths = { overview: '/api/overview', products: '/api/products', categories: '/api/categories', warehouses: '/api/warehouses', inventory: '/api/inventory', orders: '/api/orders', customers: '/api/customers', reports: `/api/reports?period=${encodeURIComponent(state.reportPeriod)}` };
    if (!paths[key]) return;
    try { state.data[key] = await api(paths[key]); }
    catch (error) { if (key === 'customers' && state.role !== 'admin') state.data[key] = []; else throw error; }
  }));
}

function formatRole() { return isAdmin() ? 'Admin' : 'Customer'; }
function syncChrome() {
  document.getElementById('role-switch-label').textContent = formatRole();
  document.getElementById('sidebar-role').textContent = isAdmin() ? 'Admin' : 'Customer';
  document.getElementById('sidebar-name').textContent = isAdmin() ? 'Olivia Rhye' : 'Olivia Rhye';
  document.getElementById('order-nav-count').textContent = number((get('overview')?.active_orders) || get('orders').filter(o => ['Processing','Shipped'].includes(o.status)).length);
  document.querySelectorAll('.admin-only').forEach(el => el.hidden = !isAdmin());
  const avatar = isAdmin() ? 'OR' : 'OR';
  document.getElementById('top-avatar').textContent = avatar;
  document.querySelector('.avatar-sidebar').textContent = avatar;
  document.querySelectorAll('.nav-item').forEach(link => link.classList.toggle('active', link.dataset.page === state.page));
  document.getElementById('breadcrumb-current').textContent = pageName(state.page);
}
function pageName(key) { return ({ overview: 'Overview', orders: 'Orders', inventory: 'Inventory', products: 'Products', warehouses: 'Warehouses', customers: 'Customers', reports: 'Reports' })[key] || 'Overview'; }
const heading = (title, description, actions = '', eyebrow = 'WORKSPACE') => `<div class="page-heading"><div class="heading-copy"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
const btn = (label, action, kind = 'primary', iconName = 'plus', extra = '') => `<button class="button button-${kind} ${extra}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
const statusPill = status => `<span class="status-pill status-${String(status).toLowerCase()}">${esc(status)}</span>`;
const productSwatch = product => `<span class="product-swatch" style="background:${esc(product.accent || '#dce5df')}">${esc(initials(product.name).slice(0,2))}</span>`;
const catTag = (name, color) => `<span class="category-tag"><i class="category-dot" style="background:${esc(color || '#9cb88f')}"></i>${esc(name)}</span>`;
const tableEmpty = (cols, message = 'Nothing here yet. Add your first item to get started.') => `<tr><td class="table-empty" colspan="${cols}">${message}</td></tr>`;

async function renderPage() {
  syncChrome();
  const root = document.getElementById('page-content');
  root.innerHTML = '<div class="loading-state"><span class="loading-spinner"></span>Getting your workspace ready…</div>';
  try {
    if (!isAdmin() && ['inventory','warehouses','customers','reports'].includes(state.page)) state.page = 'overview';
    const pageKeys = {
      overview: ['overview', 'products', 'orders', 'warehouses'], orders: ['orders', 'products', 'customers', 'warehouses'],
      inventory: ['products', 'categories', 'warehouses', 'inventory'], products: ['products', 'categories', 'warehouses'],
      warehouses: ['warehouses', 'inventory', 'products'], customers: ['customers', 'orders'], reports: ['reports']
    }[state.page] || ['overview'];
    await refresh(pageKeys);
    syncChrome();
    root.innerHTML = ({ overview: renderOverview, orders: renderOrders, inventory: renderInventory, products: renderProducts, warehouses: renderWarehouses, customers: renderCustomers, reports: renderReports })[state.page]();
    bindPageInputs();
  } catch (error) {
    root.innerHTML = `<div class="panel" style="padding:28px"><strong>We couldn’t load this view.</strong><p style="color:#86928a;font-size:11px">${esc(error.message)}</p><button class="button button-primary" data-action="reload">Try again</button></div>`;
  }
}

function renderOverview() {
  if (!isAdmin()) return renderCustomerOverview();
  const d = state.data.overview || {};
  const delta = Number(d.sales_change_pct || 0);
  const trendTone = delta >= 0 ? 'up' : 'down';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
  const actions = `${btn('New order','new-order','primary','plus')}<button class="button" data-action="add-product">${icon('plus')}<span>Add product</span></button>`;
  return `${heading(`${greeting}, Olivia <span style="color:#79975f">✳</span>`,'Here’s what’s happening with your store today.',actions,today)}
    <div class="metrics-grid">
      ${metric('revenue','Sales this month',money(d.sales_this_month),`<span class="${trendTone}">${delta >= 0 ? '↗' : '↘'} ${Math.abs(delta)}%</span><span class="metric-note">vs. last month</span>`, 'This month')}
      ${metric('package','Units in stock',number(d.units_in_stock),`<span class="neutral">Across ${number(d.total_warehouses)} locations</span>`,`${number(d.total_products)} active products`)}
      ${metric('alert','Low stock items',number(d.low_stock_count),`<span class="${d.low_stock_count ? 'down':'up'}">${d.low_stock_count ? 'Needs attention' : 'All looking good'}</span>`,`At or below reorder point`,'alert-metric')}
      ${metric('cart','Open orders',number(d.active_orders),`<span class="neutral">${number(d.active_customers)} active customers</span>`,'Processing & shipped','orders-metric')}
    </div>
    <div class="dashboard-grid">
      <section class="panel sales-panel"><div class="panel-head"><div><h2 class="panel-title">Sales overview</h2><div class="panel-subtitle">Revenue over the last 7 days</div></div><span class="online-indicator"><i></i> Live data</span></div>
        <div class="chart-summary"><strong>${money((d.sales_trend || []).reduce((sum,row)=>sum+Number(row.sales),0))}</strong><span>last 7 days</span></div>
        ${lineChart(d.sales_trend || [])}</section>
      <section class="panel alerts-panel"><div class="panel-head"><div><h2 class="panel-title">Stock alerts</h2><div class="panel-subtitle">Products that need a restock</div></div><span class="alert-total">${icon('alert')} ${number(d.low_stock_count || 0)} items</span></div>
        <div class="alert-list">${(d.low_stock_products || []).length ? d.low_stock_products.slice(0,4).map(p=>`<div class="alert-row">${productSwatch(p)}<div class="alert-product"><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)}</small></div><div class="stock-remaining">${number(p.stock)} left<small>Reorder at ${number(p.reorder_level)}</small></div></div>`).join('') : '<div class="empty-alerts"><span>✓</span>All products are comfortably stocked.</div>'}</div>
        ${d.low_stock_count ? '<div style="padding:0 17px 14px"><a class="panel-link" href="#inventory">Review all low stock →</a></div>' : ''}</section>
    </div>
    <section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Recent orders</h2><div class="panel-subtitle">The latest activity across your store</div></div><a class="panel-link" href="#orders">View all orders →</a></div>${orderTable(d.recent_orders || [], { compact: true })}</section>`;
}

function renderCustomerOverview() {
  const myOrders = get('orders');
  const paid = myOrders.filter(order => order.status !== 'Cancelled').reduce((sum,order)=>sum+Number(order.total),0);
  const open = myOrders.filter(order => ['Processing','Shipped'].includes(order.status)).length;
  const available = get('products').filter(product => Number(product.stock) > 0).length;
  const actions = btn('Place an order','new-order','primary','plus');
  return `${heading('Welcome back, Olivia','Browse the collection and keep an eye on your latest orders.',actions,'YOUR STUDIO')}
    <div class="role-banner">${icon('eye')} You’re viewing Stockroom as a customer. Your orders and account activity are private to you.</div>
    <div class="metrics-grid">${metric('cart','Your orders',number(myOrders.length),`<span class="neutral">${number(open)} in progress</span>`,'All time','orders-metric')}${metric('revenue','Your spend',money(paid),'<span class="neutral">Completed & in progress</span>','All time')}${metric('package','Available products',number(available),`<span class="neutral">Across ${number(get('categories').length || 4)} collections</span>`,'In stock now')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Your recent orders</h2><div class="panel-subtitle">Track delivery and manage your orders</div></div><a class="panel-link" href="#orders">Order history →</a></div>${orderTable(myOrders.slice(0,6), { compact: true, customer: true })}</section>
    <div style="margin-top:14px" class="panel"><div class="panel-head"><div><h2 class="panel-title">Find something for your space</h2><div class="panel-subtitle">Thoughtful pieces for everyday living.</div></div><a class="panel-link" href="#products">Explore products →</a></div><div style="padding:0 17px 16px;color:#66756b;font-size:10px">${available} products are currently available to order.</div></div>`;
}

function metric(iconName, title, value, foot, note, extra = '') {
  return `<article class="metric-card ${extra}"><div class="metric-top"><span>${title}</span><span class="metric-icon">${icon(iconName)}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`;
}

function lineChart(rows) {
  const values = rows.map(row => Number(row.sales || 0));
  const max = Math.max(...values, 1), min = Math.min(0,...values), width = 680, height = 153, left = 40, right = 10, top = 12, bottom = 24;
  const xStep = rows.length > 1 ? (width-left-right)/(rows.length-1) : 0;
  const plotHeight = height-top-bottom;
  const points = values.map((value,i)=>[left+i*xStep, top+plotHeight-(value-min)/(max-min||1)*plotHeight]);
  const line = points.map(p=>p.join(',')).join(' ');
  const area = points.length ? `${left},${height-bottom} ${line} ${points[points.length-1][0]},${height-bottom}` : '';
  const gridLines = [0,.5,1].map((ratio,i)=>{ const y=top+plotHeight*ratio; return `<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"/><text x="0" y="${y+3}">${money(max*(1-ratio))}</text>`; }).join('');
  return `<div class="chart-container"><svg class="sales-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a9c98d" stop-opacity=".22"/><stop offset="1" stop-color="#a9c98d" stop-opacity="0"/></linearGradient></defs>${gridLines}${rows.length ? `<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${points.map(([x,y])=>`<circle class="chart-dot" cx="${x}" cy="${y}" r="3"/>`).join('')}${rows.map((row,i)=>`<text x="${left+i*xStep}" y="${height-4}" text-anchor="middle">${new Date(`${row.day}T00:00:00`).toLocaleDateString('en-US',{weekday:'short'})}</text>`).join('')}` : '<text class="chart-empty" x="50%" y="52%">No sales recorded for this period</text>'}</svg></div>`;
}

function orderTable(orders, options = {}) {
  const cols = options.compact ? 5 : 7;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th>${options.compact ? '' : '<th>Warehouse</th><th></th>'}</tr></thead><tbody>${orders.length ? orders.map(order=>`<tr data-action="order-detail" data-id="${order.id}" class="clickable-row"><td><span class="order-id">${esc(order.order_number)}</span></td><td><div class="customer-cell"><span class="customer-avatar">${esc(initials(order.customer_name))}</span><span><strong>${esc(order.customer_name)}</strong><small>${esc(order.customer_company || order.customer_email || '')}</small></span></div></td><td>${dateShort(order.created_at)}</td><td class="amount-cell">${money(order.total)}</td><td>${statusPill(order.status)}</td>${options.compact ? '' : `<td><span class="warehouse-chip">${esc(order.warehouse_name)}</span></td><td><button class="row-action" data-action="order-menu" data-id="${order.id}" aria-label="Order actions">···</button></td>`}</tr>`).join('') : tableEmpty(cols, 'No orders match this view yet.')}</tbody></table></div>`;
}

function renderOrders() {
  let orders = get('orders');
  if (state.orderFilter !== 'All orders') orders = orders.filter(order => order.status === state.orderFilter);
  if (state.search) orders = orders.filter(order => `${order.order_number} ${order.customer_name} ${order.customer_company}`.toLowerCase().includes(state.search.toLowerCase()));
  const actions = btn(isAdmin() ? 'New order' : 'Place an order','new-order','primary','plus');
  const filters = ['All orders','Processing','Shipped','Delivered','Cancelled'];
  return `${heading(isAdmin() ? 'Orders' : 'Your orders',isAdmin() ? 'Keep track of every order from placement to delivery.' : 'Your order history and current delivery status.',actions,'COMMERCE')}
    <div class="table-toolbar"><div class="filter-group"><input class="search-input" id="order-search" type="search" placeholder="Search by order or customer…" value="${esc(state.search)}">${isAdmin() ? filters.map(filter=>`<button class="filter-chip ${state.orderFilter===filter?'active':''}" data-action="order-filter" data-filter="${esc(filter)}">${filter}</button>`).join('') : ''}</div><span class="online-indicator"><i></i> Refreshes automatically</span></div>
    <section class="panel table-panel">${orderTable(orders,{customer:!isAdmin()})}<div class="pagination"><span>Showing ${orders.length ? 1 : 0}–${orders.length} of ${orders.length} orders</span><span>Updated just now</span></div></section>`;
}

function renderProducts() {
  const categories = get('categories'); let products = get('products');
  if (state.productCategory !== 'All products') products = products.filter(p => p.category === state.productCategory);
  if (state.search) products = products.filter(p => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(state.search.toLowerCase()));
  const filters = ['All products', ...categories.map(c => c.name)];
  const actions = `${isAdmin() ? btn('New category','new-category','secondary','plus','button-sm') : ''}${btn(isAdmin() ? 'Add product' : 'Place an order', isAdmin() ? 'add-product' : 'new-order','primary','plus')}`;
  return `${heading(isAdmin() ? 'Products' : 'The collection',isAdmin() ? 'Manage your catalog, pricing and product availability.' : 'Discover considered pieces for the home. Place an order in just a few steps.',actions,'CATALOG')}
    <div class="table-toolbar"><div class="filter-group"><input class="search-input" id="product-search" type="search" placeholder="Search products or SKU…" value="${esc(state.search)}">${filters.map(filter=>`<button class="filter-chip ${state.productCategory===filter?'active':''}" data-action="category-filter" data-filter="${esc(filter)}">${esc(filter)}</button>`).join('')}</div><span class="online-indicator"><i></i> Stock updates live</span></div>
    <section class="panel table-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>SKU</th><th>Price</th><th>In stock</th><th>Stock health</th>${isAdmin() ? '<th></th>' : '<th></th>'}</tr></thead><tbody>${products.length ? products.map(p=>`<tr><td><div class="customer-cell">${productSwatch(p)}<span><strong>${esc(p.name)}</strong><small>${esc(p.unit)} · ${number(p.warehouse_count)} locations</small></span></div></td><td>${catTag(p.category,p.category_color)}</td><td>${esc(p.sku)}</td><td class="amount-cell">${preciseMoney(p.price)}</td><td><span class="stock-number">${number(p.stock)}</span> <span style="color:#9ba49e;font-size:8px">${esc(p.unit)}${p.stock===1?'':'s'}</span></td><td>${stockHealth(p.stock,p.reorder_level)}</td><td>${isAdmin() ? `<button class="row-action" data-action="edit-product" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">···</button>` : `<button class="button button-sm button-primary" data-action="buy-product" data-id="${p.id}">Order</button>`}</td></tr>`).join('') : tableEmpty(7,'No products match this filter.')}</tbody></table></div><div class="pagination"><span>Showing ${products.length} of ${get('products').length} products</span><span>${isAdmin() ? `${categories.length} categories` : 'Prices shown in USD'}</span></div></section>`;
}

function stockHealth(stock, reorder) {
  const ratio = reorder ? Number(stock)/Number(reorder) : 1;
  const kind = Number(stock) === 0 ? 'out' : ratio <= 1 ? 'low' : 'ok';
  const label = kind === 'out' ? 'Out of stock' : kind === 'low' ? 'Low stock' : 'In stock';
  return `<span class="inventory-state ${kind}"><span class="progress"><i style="width:${Math.max(4,Math.min(100,ratio*50))}%"></i></span>${label}</span>`;
}

function renderInventory() {
  let rows = get('inventory');
  if (state.inventoryFilter === 'Low stock') rows = rows.filter(row=>Number(row.total_stock)<=Number(row.reorder_level));
  if (state.inventoryFilter === 'In stock') rows = rows.filter(row=>Number(row.quantity)>0);
  if (state.search) rows = rows.filter(row=>`${row.product_name} ${row.sku} ${row.warehouse_name}`.toLowerCase().includes(state.search.toLowerCase()));
  const inv = get('inventory'); const units = inv.reduce((sum,row)=>sum+Number(row.quantity),0);
  const actions = btn('Adjust stock','adjust-stock','primary','plus');
  return `${heading('Inventory','A clear view of stock across all your warehouse locations.',actions,'STOCK CONTROL')}
    <div class="metrics-grid">${metric('package','Total units',number(units),'<span class="neutral">Across all locations</span>','Live inventory','')}${metric('alert','Products below reorder',number(get('products').filter(p=>p.stock<=p.reorder_level).length),'<span class="down">Review replenishment</span>','Based on product thresholds','alert-metric')}${metric('warehouse','Warehouse locations',number(get('warehouses').length),'<span class="neutral">All locations connected</span>','Stock by location')}</div>
    <div class="table-toolbar"><div class="filter-group"><input class="search-input" id="inventory-search" type="search" placeholder="Search product or location…" value="${esc(state.search)}">${['All stock','Low stock','In stock'].map(filter=>`<button class="filter-chip ${state.inventoryFilter===filter?'active':''}" data-action="inventory-filter" data-filter="${filter}">${filter}</button>`).join('')}</div><span class="online-indicator"><i></i> Live stock levels</span></div>
    <section class="panel table-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Warehouse</th><th>On hand</th><th>Reorder point</th><th>Stock health</th><th>Last updated</th><th></th></tr></thead><tbody>${rows.length ? rows.map(row=>`<tr><td><div class="customer-cell">${productSwatch(row)}<span><strong>${esc(row.product_name)}</strong><small>${esc(row.sku)} · ${esc(row.category)}</small></span></div></td><td><span class="warehouse-chip">${esc(row.warehouse_name)}</span></td><td><span class="stock-number">${number(row.quantity)}</span> <span style="font-size:8px;color:#98a19b">${esc(row.unit)}${row.quantity===1?'':'s'}</span></td><td>${number(row.reorder_level)} ${esc(row.unit)}s</td><td>${stockHealth(row.total_stock,row.reorder_level)}</td><td>${dateShort(row.updated_at)}</td><td><button class="row-action" data-action="adjust-stock" data-product="${row.product_id}" data-warehouse="${row.warehouse_id}" aria-label="Adjust stock">＋</button></td></tr>`).join('') : tableEmpty(7,'No inventory records found.')}</tbody></table></div><div class="pagination"><span>Showing ${rows.length} warehouse stock records</span><span>Threshold is set per product</span></div></section>`;
}

function renderWarehouses() {
  const locations = get('warehouses'); const inventory = get('inventory'); const products = get('products');
  const cards = locations.map(w=>{
    const rows=inventory.filter(r=>r.warehouse_id===w.id), units=rows.reduce((s,r)=>s+Number(r.quantity),0), low=products.filter(p=>Number(inventory.find(r=>r.product_id===p.id&&r.warehouse_id===w.id)?.quantity||0)<=p.reorder_level).length;
    return `<article class="warehouse-card"><div class="warehouse-card-top"><span class="warehouse-icon">${icon('warehouse')}</span><span class="warehouse-code">${esc(w.code)}</span></div><h3>${esc(w.name)}</h3><div class="warehouse-city">${icon('pin')} ${esc(w.city)}</div><div class="warehouse-stats"><div><strong>${number(units)}</strong><span>units on hand</span></div><div><strong>${number(rows.length)}</strong><span>SKUs stocked</span></div><div><strong style="color:${low?'#c77c4f':'#5a824e'}">${number(low)}</strong><span>low stock</span></div></div></article>`;
  }).join('');
  const actions = btn('Add warehouse','add-warehouse','primary','plus');
  return `${heading('Warehouses','See what’s stored where and keep every location in sync.',actions,'LOCATIONS')}<div class="warehouse-card-grid">${cards}</div>
    <div class="split-layout"><section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Location inventory</h2><div class="panel-subtitle">On-hand quantities across your network</div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th>${locations.map(w=>`<th>${esc(w.code)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${products.map(p=>`<tr><td><div class="customer-cell">${productSwatch(p)}<span><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small></span></div></td>${locations.map(w=>{const row=inventory.find(r=>r.product_id===p.id&&r.warehouse_id===w.id);return `<td><span class="stock-number">${number(row?.quantity||0)}</span></td>`}).join('')}<td class="amount-cell">${number(p.stock)}</td></tr>`).join('')}</tbody></table></div></section>
      <aside class="side-column"><div class="side-card"><h3>Network overview</h3><p>Stock is pooled across every active warehouse location.</p><div class="side-stat"><span>Locations</span><strong>${locations.length}</strong></div><div class="side-stat"><span>Tracked products</span><strong>${products.length}</strong></div><div class="side-stat"><span>Total units</span><strong>${number(inventory.reduce((s,r)=>s+Number(r.quantity),0))}</strong></div></div><div class="side-card"><h3>Need another location?</h3><p>Add a warehouse to track stock in a new city or fulfilment center.</p>${btn('Add warehouse','add-warehouse','secondary','plus','button-sm')}</div></aside></div>`;
}

function renderCustomers() {
  let customers = get('customers');
  if (state.search) customers=customers.filter(c=>`${c.name} ${c.company} ${c.email}`.toLowerCase().includes(state.search.toLowerCase()));
  const totalValue=customers.reduce((s,c)=>s+Number(c.lifetime_value),0);
  return `${heading('Customers','Your customer relationships, all in one place.',btn('Add customer','add-customer','primary','plus'),'PEOPLE')}
    <div class="metrics-grid">${metric('people','Total customers',number(get('customers').length),'<span class="neutral">Customer records</span>','All time','customers-metric')}${metric('revenue','Lifetime sales',money(totalValue),'<span class="neutral">Excludes cancelled orders</span>','Across all customers')}${metric('cart','Orders placed',number(get('orders').length),'<span class="neutral">All time</span>','Customer orders','orders-metric')}</div>
    <div class="table-toolbar"><input class="search-input" id="customer-search" type="search" placeholder="Search customers…" value="${esc(state.search)}"><span class="online-indicator"><i></i> Customer records</span></div>
    <section class="panel table-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Company</th><th>Orders</th><th>Lifetime value</th><th>Customer since</th></tr></thead><tbody>${customers.length?customers.map(c=>`<tr><td><div class="customer-cell"><span class="customer-avatar">${esc(initials(c.name))}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.email)}</small></span></div></td><td>${esc(c.company||'—')}</td><td>${number(c.order_count)}</td><td class="amount-cell">${money(c.lifetime_value)}</td><td>${dateShort(c.created_at)}</td></tr>`).join(''):tableEmpty(5,'No customers found.')}</tbody></table></div></section>`;
}

function renderReports() {
  const report=get('reports')||{}; const summary=report.summary||{}; const daily=report.daily||[]; const max=Math.max(...daily.map(d=>Number(d.sales)),1);
  const labels=state.reportPeriod==='7d'?'last 7 days':state.reportPeriod==='30d'?'last 30 days':state.reportPeriod==='90d'?'last 90 days':'last 12 months';
  const barData=state.reportPeriod==='12m'?compressMonths(daily):daily;
  return `${heading('Sales reports','A closer look at sales, product performance and order trends.',`<select class="select-mini" id="report-period"><option value="7d" ${state.reportPeriod==='7d'?'selected':''}>Last 7 days</option><option value="30d" ${state.reportPeriod==='30d'?'selected':''}>Last 30 days</option><option value="90d" ${state.reportPeriod==='90d'?'selected':''}>Last 90 days</option><option value="12m" ${state.reportPeriod==='12m'?'selected':''}>Last 12 months</option></select><button class="button" data-action="export-report">${icon('down')}<span>Export CSV</span></button>`,'ANALYTICS')}
    <div class="report-kpis"><div class="report-kpi"><span>Gross sales · ${labels}</span><strong>${money(summary.sales)}</strong></div><div class="report-kpi"><span>Orders fulfilled & in progress</span><strong>${number(summary.orders)}</strong></div><div class="report-kpi"><span>Customers</span><strong>${number(summary.customers)}</strong></div></div>
    <div class="report-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Sales over time</h2><div class="panel-subtitle">Daily revenue · ${labels}</div></div></div><div class="bars-wrap">${barData.map(row=>`<div class="bar-item" title="${dateFull(row.day)} · ${money(row.sales)}"><div class="bar" style="height:${Math.max(2,Number(row.sales)/max*100)}%"></div><span class="bar-label">${new Date(`${row.day}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:state.reportPeriod==='7d'?'numeric':undefined})}</span></div>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Sales by category</h2><div class="panel-subtitle">Revenue contribution · ${labels}</div></div></div><div class="donut-row" style="padding:12px 17px 18px">${report.categories?.length ? report.categories.map(row=>`<div class="category-row"><i style="background:${esc(row.color)}"></i><span>${esc(row.name)}</span><strong>${money(row.sales)}</strong></div>`).join('') : '<div style="font-size:10px;color:#9aa39d;padding:20px 0">No category sales in this period.</div>'}</div></section></div>
    <section class="panel table-panel"><div class="panel-head"><div><h2 class="panel-title">Top products</h2><div class="panel-subtitle">Best performing by revenue</div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Units sold</th><th>Revenue</th></tr></thead><tbody>${report.top_products?.length?report.top_products.map((p,i)=>`<tr><td><div class="customer-cell"><span class="product-swatch" style="background:${['#d8d6c8','#e4ca9d','#c8d6cf','#d7c7c2','#d8cbb9'][i%5]}">${i+1}</span><span><strong>${esc(p.name)}</strong><small>Top ${i+1} by sales</small></span></div></td><td>${esc(p.sku)}</td><td>${number(p.units)}</td><td class="amount-cell">${money(p.sales)}</td></tr>`).join(''):tableEmpty(4,'No product sales in this period.')}</tbody></table></div></section>`;
}
function compressMonths(daily) {
  const months = new Map();
  daily.forEach(row => { const key=row.day.slice(0,7); const prev=months.get(key)||{day:`${key}-01`,sales:0}; prev.sales += Number(row.sales); months.set(key,prev); });
  return [...months.values()];
}

function bindPageInputs() {
  const orderSearch=document.getElementById('order-search'); if(orderSearch) orderSearch.addEventListener('input',()=>{state.search=orderSearch.value;const pos=orderSearch.selectionStart;document.getElementById('page-content').innerHTML=renderOrders();bindPageInputs();preserveCursor('order-search',pos);});
  const productSearch=document.getElementById('product-search'); if(productSearch) productSearch.addEventListener('input',()=>{state.search=productSearch.value; const root=document.getElementById('page-content'); const pos=productSearch.selectionStart; root.innerHTML=renderProducts(); bindPageInputs(); const next=document.getElementById('product-search');next?.focus();next?.setSelectionRange(pos,pos);});
  const inventorySearch=document.getElementById('inventory-search'); if(inventorySearch) inventorySearch.addEventListener('input',()=>{state.search=inventorySearch.value; const root=document.getElementById('page-content'); const pos=inventorySearch.selectionStart;root.innerHTML=renderInventory();bindPageInputs();const next=document.getElementById('inventory-search');next?.focus();next?.setSelectionRange(pos,pos);});
  const customerSearch=document.getElementById('customer-search'); if(customerSearch) customerSearch.addEventListener('input',()=>{state.search=customerSearch.value;const pos=customerSearch.selectionStart;document.getElementById('page-content').innerHTML=renderCustomers();bindPageInputs();preserveCursor('customer-search',pos);});
  const period=document.getElementById('report-period'); if(period) period.addEventListener('change',async()=>{state.reportPeriod=period.value;await renderPage();});
}
function preserveCursor(id,pos){const next=document.getElementById(id);next?.focus();next?.setSelectionRange(pos,pos);}

function showModal(title, subtitle, body, footer = '', wide = false) {
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" data-action="backdrop-close"><div class="modal-card ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><div><h2>${title}</h2><p>${subtitle||''}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>${body}${footer}</div></div>`;
  document.body.style.overflow='hidden';
  document.querySelector('.modal-backdrop')?.addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop')) closeModal();});
}
function closeModal(){document.getElementById('modal-root').innerHTML='';document.body.style.overflow='';}
const formFooter=(cancel='Cancel',save='Save changes')=>`<div class="modal-footer"><button type="button" class="button" data-action="close-modal">${cancel}</button><button type="submit" class="button button-primary">${save}</button></div>`;
const field=(label,name,content,full=false,hint='')=>`<div class="field ${full?'full':''}"><label for="f-${name}">${label}</label>${content.replace('id=""',`id="f-${name}"`)}${hint?`<span class="hint">${hint}</span>`:''}</div>`;
const input=(name,type='text',value='',attrs='')=>`<input id="" name="${name}" type="${type}" value="${esc(value)}" ${attrs}>`;
const select=(name,options,selected='',attrs='')=>`<select id="" name="${name}" ${attrs}>${options.map(option=>typeof option==='string'?`<option value="${esc(option)}" ${selected===option?'selected':''}>${esc(option)}</option>`:`<option value="${esc(option.value)}" ${String(selected)===String(option.value)?'selected':''} ${option.disabled?'disabled':''}>${esc(option.label)}</option>`).join('')}</select>`;
function modalForm(title,subtitle,formAction,content,save='Save changes',wide=false){showModal(title,subtitle,`<form id="modal-form" data-form="${formAction}"><div class="modal-body">${content}<div class="form-error" hidden></div></div>${formFooter('Cancel',save)}</form>`,'',wide);}
function showError(message){const box=document.querySelector('.form-error');if(box){box.textContent=message;box.hidden=false;}else toast('Something went wrong',message,true);}

async function openNewOrder(productId=null) {
  try { await refresh(['products','warehouses','customers','inventory']); } catch(e){toast('Could not open order',e.message,true);return;}
  const products=get('products').filter(p=>p.stock>0), warehouses=get('warehouses');
  if(!products.length){toast('No products available','There is no stock available to order right now.',true);return;}
  const selectedWarehouse=warehouses.find(w=>productId&&get('inventory').some(stock=>stock.product_id===productId&&stock.warehouse_id===w.id&&stock.quantity>0))||warehouses.find(w=>products.some(p=>get('inventory').some(stock=>stock.product_id===p.id&&stock.warehouse_id===w.id&&stock.quantity>0)))||warehouses[0];
  const firstAvailable=products.find(p=>get('inventory').some(stock=>stock.product_id===p.id&&stock.warehouse_id===selectedWarehouse?.id&&stock.quantity>0));
  const selectedProduct=productId&&products.some(p=>p.id===productId&&get('inventory').some(stock=>stock.product_id===productId&&stock.warehouse_id===selectedWarehouse?.id&&stock.quantity>0))?productId:firstAvailable?.id;
  const customerOptions=get('customers').map(c=>({value:c.id,label:`${c.name}${c.company?` · ${c.company}`:''}`}));
  const warehouseOptions=warehouses.map(w=>({value:w.id,label:`${w.name} · ${w.city}`}));
  const productOptions=products.map(p=>({value:p.id,label:`${p.name} · ${preciseMoney(p.price)} · ${p.stock} available`}));
  const lines=`<div class="order-items-form" id="order-lines">${orderLine(productOptions,selectedProduct)}</div><button type="button" class="add-line" data-action="add-order-line">${icon('plus')} Add another product</button>`;
  const content=`<div class="form-grid">${isAdmin()?field('Customer','customer_id',select('customer_id',customerOptions,customerOptions[0]?.value)):''}${field('Fulfil from','warehouse_id',select('warehouse_id',warehouseOptions,selectedWarehouse?.id,'data-warehouse-select'))}<div class="field full"><label>Order items</label>${lines}</div><div class="field full"><div class="order-total-bar"><span>Order total</span><strong id="order-total">${preciseMoney(0)}</strong></div></div></div>`;
  modalForm(isAdmin()?'Create a new order':'Place an order',isAdmin()?'Stock will be reserved from the selected warehouse.':'Your order will be sent to the selected warehouse.','new-order',content,'Place order',true);
  updateOrderTotal();
}
function orderLine(productOptions,selectedId=null){return `<div class="order-line"><div class="field"><label>Product</label>${select('product_id',productOptions,selectedId??productOptions[0]?.value,'data-product-select')}</div><div class="field"><label>Quantity</label>${input('quantity','number','1','min="1" max="10000" data-quantity')}</div><button class="remove-line" type="button" data-action="remove-order-line" aria-label="Remove item">×</button></div>`;}
function updateOrderTotal(){
  const warehouse=Number(document.querySelector('[name="warehouse_id"]')?.value);let total=0;
  document.querySelectorAll('.order-line').forEach(row=>{
    const selectEl=row.querySelector('[name="product_id"]'), id=Number(selectEl?.value), qty=Number(row.querySelector('[name="quantity"]')?.value||0), p=get('products').find(item=>item.id===id);
    row.querySelectorAll('option').forEach(option=>{
      const item=get('products').find(product=>product.id===Number(option.value));
      if(!item)return;
      const available=Number(get('inventory').find(stock=>stock.product_id===item.id&&stock.warehouse_id===warehouse)?.quantity||0);
      option.textContent=`${item.name} · ${preciseMoney(item.price)} · ${available} available here`;
      option.disabled=available===0 && option.value!==selectEl.value;
    });
    const available=Number(get('inventory').find(stock=>stock.product_id===id&&stock.warehouse_id===warehouse)?.quantity||0);
    if(selectEl&&p)selectEl.title=`${available} available at this location`;
    const quantityField=row.querySelector('[name="quantity"]');if(quantityField&&available>0)quantityField.max=String(available);
    if(p)total+=p.price*qty;
  });
  const output=document.getElementById('order-total');if(output)output.textContent=preciseMoney(total);
}

function openProductModal(product=null){const categories=get('categories'),warehouses=get('warehouses'),edit=!!product;const content=`<div class="form-grid">${field('Product name','name',input('name','text',product?.name||'','required maxlength="100"'))}${field('SKU','sku',input('sku','text',product?.sku||'','required maxlength="30"'))}${field('Category','category_id',select('category_id',categories.map(c=>({value:c.id,label:c.name})),product?.category_id||categories[0]?.id))}${field('Price (USD)','price',input('price','number',product?.price||'','required min="0" step="0.01"'))}${field('Reorder point','reorder_level',input('reorder_level','number',product?.reorder_level??10,'min="0" step="1"'))}${field('Unit','unit',input('unit','text',product?.unit||'piece','maxlength="20"'))}${edit?'':field('Initial quantity','initial_stock',input('initial_stock','number','0','min="0" step="1"'))}${edit?'':field('Add initial stock to','warehouse_id',select('warehouse_id',warehouses.map(w=>({value:w.id,label:w.name})),warehouses[0]?.id))}${field('Product color','accent',input('accent','color',product?.accent||'#dce5df',''))}${field('Description','description',`<textarea id="" name="description" maxlength="500">${esc(product?.description||'')}</textarea>`,true)}</div>`;
  modalForm(edit?'Edit product':'Add a product',edit?'Update product details in your catalog.':'Add a product to your catalog and set its reorder point.',edit?`edit-product:${product.id}`:'add-product',content,edit?'Save product':'Create product',true);}
function openCategoryModal(){const content=`<div class="form-grid">${field('Category name','name',input('name','text','','required maxlength="50"'))}${field('Category color','color',input('color','color','#9cb88f'))}</div>`;modalForm('Add a category','Create a collection to organize your catalog.','add-category',content,'Create category');}
function openWarehouseModal(){const content=`<div class="form-grid">${field('Warehouse name','name',input('name','text','','required maxlength="80"'))}${field('Location code','code',input('code','text','','required maxlength="20"'))}${field('City','city',input('city','text','','required maxlength="60"'))}</div>`;modalForm('Add a warehouse','Set up a new location for your stock.','add-warehouse',content,'Add warehouse');}
function openCustomerModal(){const content=`<div class="form-grid">${field('Full name','name',input('name','text','','required maxlength="100"'))}${field('Email address','email',input('email','email','','required maxlength="160"'))}${field('Company','company',input('company','text','','maxlength="100"'),true)}</div>`;modalForm('Add a customer','Add a customer to your workspace.','add-customer',content,'Add customer');}
function openStockModal(productId=null,warehouseId=null){const products=get('products'),warehouses=get('warehouses');const content=`<div class="form-grid">${field('Product','product_id',select('product_id',products.map(p=>({value:p.id,label:`${p.name} · ${p.sku}`})),productId||products[0]?.id))}${field('Warehouse','warehouse_id',select('warehouse_id',warehouses.map(w=>({value:w.id,label:w.name})),warehouseId||warehouses[0]?.id))}${field('Quantity change','change',input('change','number','','required step="1" placeholder="e.g. 24 or -3"'),true,'Use a positive number to add stock, or a negative number to remove it.')}${field('Reason','reason',select('reason',['New delivery','Stock count correction','Damaged goods','Return to stock','Other'],'New delivery'),true)}</div>`;modalForm('Adjust stock','Record a stock movement at a warehouse.','adjust-stock',content,'Update stock');}

async function openOrderDetails(id){try{const order=await api(`/api/orders/${id}`);const canCancel=order.status==='Processing';const items=order.items.map(item=>`<div class="detail-item"><span>${esc(item.product_name)} <span style="color:#98a29b">× ${number(item.quantity)}</span></span><strong>${money(item.line_total)}</strong></div>`).join('');const body=`<div class="modal-body"><div class="detail-list"><div class="detail-row"><span>Order number</span><span>${esc(order.order_number)}</span></div><div class="detail-row"><span>Status</span><span>${statusPill(order.status)}</span></div><div class="detail-row"><span>Placed on</span><span>${dateFull(order.created_at)}</span></div><div class="detail-row"><span>Customer</span><span>${esc(order.customer_name)}</span></div><div class="detail-row"><span>Warehouse</span><span>${esc(order.warehouse_name)}, ${esc(order.warehouse_city)}</span></div></div><div class="detail-items">${items}</div><div class="order-total-bar" style="margin-top:12px"><span>Total</span><strong>${money(order.total)}</strong></div></div>`;const footer=`<div class="modal-footer">${canCancel?`<button class="button button-danger" data-action="cancel-order" data-id="${order.id}">Cancel order</button>`:''}${isAdmin()&&order.status==='Processing'?`<button class="button button-dark" data-action="advance-order" data-id="${order.id}" data-status="Shipped">Mark as shipped</button>`:''}${isAdmin()&&order.status==='Shipped'?`<button class="button button-dark" data-action="advance-order" data-id="${order.id}" data-status="Delivered">Mark delivered</button>`:''}<button class="button" data-action="close-modal">Close</button></div>`;showModal(`Order ${esc(order.order_number)}`,'Order details and line items',body,footer);}catch(e){toast('Could not open order',e.message,true);}}
function confirmCancel(id){const order=get('orders').find(o=>o.id===Number(id));showModal('Cancel this order?','Stock will be returned to the warehouse.',`<div class="modal-body"><p style="font-size:10px;color:#718078;line-height:1.6">Cancel ${esc(order?.order_number||'this order')}? This cannot be undone. Any reserved stock will be returned immediately.</p></div>`,`<div class="modal-footer"><button class="button" data-action="close-modal">Keep order</button><button class="button button-danger" data-action="confirm-cancel" data-id="${id}">Yes, cancel order</button></div>`);}

async function submitForm(form){const fd=new FormData(form),action=form.dataset.form,errorBox=form.querySelector('.form-error');if(errorBox)errorBox.hidden=true;const submit=form.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Saving…';}
  try {
    let result;
    if(action==='new-order'){
      const items=[...form.querySelectorAll('.order-line')].map(row=>({product_id:Number(row.querySelector('[name="product_id"]').value),quantity:Number(row.querySelector('[name="quantity"]').value)}));
      const body={warehouse_id:Number(fd.get('warehouse_id')),items}; if(isAdmin())body.customer_id=Number(fd.get('customer_id'));
      result=await api('/api/orders',{method:'POST',body:JSON.stringify(body)});closeModal();await refresh(['orders','overview','products','inventory']);await renderPage();toast('Order placed',`${result.order_number} is now processing.`);
    } else if(action==='add-product'){
      const body=Object.fromEntries(fd.entries());['category_id','price','reorder_level','initial_stock','warehouse_id'].forEach(k=>{if(body[k]!==undefined)body[k]=Number(body[k]);});
      result=await api('/api/products',{method:'POST',body:JSON.stringify(body)});closeModal();await refresh(['products','overview','inventory']);await renderPage();toast('Product created',`${result.name} is now in your catalog.`);
    } else if(action.startsWith('edit-product:')){
      const id=action.split(':')[1],body=Object.fromEntries(fd.entries());['category_id','price','reorder_level'].forEach(k=>body[k]=Number(body[k]));
      result=await api(`/api/products/${id}`,{method:'PATCH',body:JSON.stringify(body)});closeModal();await refresh(['products','inventory']);await renderPage();toast('Product updated',`${result.name} details have been saved.`);
    } else if(action==='add-category'){
      result=await api('/api/categories',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))});closeModal();await refresh(['categories','products']);await renderPage();toast('Category created',`${result.name} is ready to use.`);
    } else if(action==='add-warehouse'){
      result=await api('/api/warehouses',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))});closeModal();await refresh(['warehouses','inventory']);await renderPage();toast('Warehouse added',`${result.name} is ready for stock.`);
    } else if(action==='add-customer'){
      result=await api('/api/customers',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))});closeModal();await refresh(['customers']);await renderPage();toast('Customer added',`${result.name} is now in your contacts.`);
    } else if(action==='adjust-stock'){
      const body=Object.fromEntries(fd.entries());['product_id','warehouse_id','change'].forEach(k=>body[k]=Number(body[k]));
      result=await api('/api/inventory/adjust',{method:'POST',body:JSON.stringify(body)});closeModal();await refresh(['inventory','products','overview']);await renderPage();toast('Stock updated',`The new on-hand quantity is ${result.quantity}.`);
    }
  } catch(error) {showError(error.message);if(submit){submit.disabled=false;submit.textContent=action==='new-order'?'Place order':'Save changes';}}
}

function toast(title,message,error=false){const region=document.getElementById('toast-region');const item=document.createElement('div');item.className=`toast ${error?'error':''}`;item.innerHTML=`<strong>${esc(title)}</strong><span>${esc(message)}</span>`;region.append(item);setTimeout(()=>item.remove(),4200);}
function exportReport(){const report=get('reports'),rows=[['Date','Sales','Orders'],...(report.daily||[]).map(r=>[r.day,r.sales,r.orders])];const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`stockroom-sales-${state.reportPeriod}.csv`;a.click();URL.revokeObjectURL(url);toast('Report exported','Your sales CSV is ready.');}

document.addEventListener('click',async event=>{
  const link=event.target.closest('.nav-item,[data-page]');
  if(link?.dataset.page){event.preventDefault();state.page=link.dataset.page;state.search='';location.hash=state.page;document.getElementById('sidebar').classList.remove('open');await renderPage();return;}
  const actionEl=event.target.closest('[data-action]');if(!actionEl)return;const action=actionEl.dataset.action;
  if(action==='reload'){await renderPage();return;}
  if(action==='role-switch'){state.role=isAdmin()?'customer':'admin';localStorage.setItem('stockroom-role',state.role);state.page='overview';state.search='';syncChrome();await renderPage();toast(`Viewing as ${formatRole()}`,isAdmin()?'Admin tools are available.':'You’ll only see your own orders.');return;}
  if(action==='new-order'){await openNewOrder();return;}
  if(action==='buy-product'){await openNewOrder(Number(actionEl.dataset.id));return;}
  if(action==='add-product'){await refresh(['categories','warehouses']);openProductModal();return;}
  if(action==='new-category'){openCategoryModal();return;}
  if(action==='add-warehouse'){await refresh(['warehouses']);openWarehouseModal();return;}
  if(action==='add-customer'){openCustomerModal();return;}
  if(action==='adjust-stock'){await refresh(['products','warehouses']);openStockModal(Number(actionEl.dataset.product)||null,Number(actionEl.dataset.warehouse)||null);return;}
  if(action==='order-detail'){if(event.target.closest('button'))return;await openOrderDetails(actionEl.dataset.id);return;}
  if(action==='order-menu'){await openOrderDetails(actionEl.dataset.id);return;}
  if(action==='cancel-order'){confirmCancel(actionEl.dataset.id);return;}
  if(action==='confirm-cancel'){try{await api(`/api/orders/${actionEl.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:'Cancelled'})});closeModal();await refresh(['orders','overview','products','inventory']);await renderPage();toast('Order cancelled','Reserved stock has been returned.');}catch(e){closeModal();toast('Could not cancel order',e.message,true);}return;}
  if(action==='advance-order'){try{await api(`/api/orders/${actionEl.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:actionEl.dataset.status})});closeModal();await refresh(['orders','overview']);await renderPage();toast('Order updated',`Order marked ${actionEl.dataset.status.toLowerCase()}.`);}catch(e){toast('Could not update order',e.message,true);}return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='backdrop-close'){if(event.target===actionEl)closeModal();return;}
  if(action==='order-filter'){state.orderFilter=actionEl.dataset.filter;await renderPage();return;}
  if(action==='category-filter'){state.productCategory=actionEl.dataset.filter;document.getElementById('page-content').innerHTML=renderProducts();bindPageInputs();return;}
  if(action==='inventory-filter'){state.inventoryFilter=actionEl.dataset.filter;document.getElementById('page-content').innerHTML=renderInventory();bindPageInputs();return;}
  if(action==='edit-product'){await refresh(['products','categories','warehouses']);const product=get('products').find(p=>p.id===Number(actionEl.dataset.id));if(product)openProductModal(product);return;}
  if(action==='add-order-line'){const options=get('products').filter(p=>p.stock>0).map(p=>({value:p.id,label:`${p.name} · ${preciseMoney(p.price)} · ${p.stock} available`}));document.getElementById('order-lines').insertAdjacentHTML('beforeend',orderLine(options));updateOrderTotal();return;}
  if(action==='remove-order-line'){if(document.querySelectorAll('.order-line').length>1){actionEl.closest('.order-line').remove();updateOrderTotal();}return;}
  if(action==='export-report'){exportReport();return;}
});

document.addEventListener('submit',event=>{if(event.target.id==='modal-form'){event.preventDefault();submitForm(event.target);}});
document.addEventListener('input',event=>{if(event.target.matches('[name="quantity"]'))updateOrderTotal();});
document.addEventListener('change',event=>{if(event.target.matches('[name="product_id"],[name="warehouse_id"]'))updateOrderTotal();});
document.getElementById('sidebar-profile').addEventListener('click',()=>document.getElementById('role-switch').click());
document.getElementById('mobile-menu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('global-search').addEventListener('input',event=>{state.search=event.target.value;const renderers={products:renderProducts,orders:renderOrders,inventory:renderInventory,customers:renderCustomers};if(renderers[state.page]){document.getElementById('page-content').innerHTML=renderers[state.page]();bindPageInputs();}});
document.getElementById('global-search').addEventListener('keydown',event=>{if(event.key==='Escape'){event.target.value='';state.search='';renderPage();}if(event.key==='Enter'){const page=isAdmin()?'products':'products';state.page=page;location.hash=page;renderPage();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.modal-backdrop'))closeModal();});
window.addEventListener('hashchange',()=>{const page=location.hash.replace('#','');if(page && pageName(page)){state.page=page;state.search='';renderPage();}});
window.addEventListener('focus',()=>{if(document.visibilityState==='visible')renderPage();});
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('.modal-backdrop')){const keys=state.page==='overview'?['overview','orders','products']:state.page==='orders'?['orders']:state.page==='inventory'?['inventory','products']:state.page==='products'?['products']:[];refresh(keys).then(()=>{const root=document.getElementById('page-content');if(!document.querySelector('.modal-backdrop')){root.innerHTML=({overview:renderOverview,orders:renderOrders,inventory:renderInventory,products:renderProducts})[state.page]?.()||root.innerHTML;bindPageInputs();syncChrome();}}).catch(()=>{});}},15000);

if(location.hash){const target=location.hash.slice(1);if(pageName(target))state.page=target;}
syncChrome();renderPage();
