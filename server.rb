#!/usr/bin/env ruby
# Stockroom demo: a small REST API and SQLite-backed inventory app.

require 'json'
require 'sqlite3'
require 'webrick'
require 'time'
require 'date'
require 'pathname'
require 'fileutils'

ROOT = Pathname.new(__dir__).realpath
DB_PATH = Pathname.new(ENV.fetch('STOCKROOM_DB', ROOT.join('stockroom.sqlite3').to_s))
PORT = Integer(ENV.fetch('PORT', '8000'))
BIND_ADDRESS = ENV.fetch('BIND_ADDRESS', '127.0.0.1')

class APIError < StandardError
  attr_reader :status
  def initialize(message, status = 400)
    super(message)
    @status = status
  end
end

def db_connect
  FileUtils.mkdir_p(DB_PATH.dirname)
  db = SQLite3::Database.new(DB_PATH.to_s)
  db.results_as_hash = true
  db.busy_timeout = 8000
  db.execute('PRAGMA foreign_keys = ON')
  db
end

def rows(db, sql, params = [])
  db.execute(sql, params).map { |row| row.reject { |key, _| key.is_a?(Integer) } }
end

def first(db, sql, params = [])
  rows(db, sql, params).first
end

def init_db
  db = db_connect
  db.execute_batch(<<~SQL)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#a7b9a7', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, city TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, company TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT NOT NULL DEFAULT '', price REAL NOT NULL CHECK(price >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 10 CHECK(reorder_level >= 0),
      unit TEXT NOT NULL DEFAULT 'unit', accent TEXT NOT NULL DEFAULT '#dce5df', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), updated_at TEXT NOT NULL,
      PRIMARY KEY(product_id, warehouse_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      status TEXT NOT NULL DEFAULT 'Processing', total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0)
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id), change INTEGER NOT NULL,
      reason TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
  SQL
  seed_db(db) if first(db, 'SELECT COUNT(*) AS n FROM products')['n'].zero?
ensure
  db&.close
end

def seed_db(db)
  now = Time.now.utc.iso8601
  [['Furniture', '#d8d6c8'], ['Lighting', '#e4ca9d'], ['Tableware', '#c8d6cf'], ['Textiles', '#d7c7c2']].each do |name, color|
    db.execute('INSERT INTO categories(name,color,created_at) VALUES(?,?,?)', [name, color, now])
  end
  [['Brooklyn Studio', 'New York', 'NYC-01'], ['West Coast Hub', 'Los Angeles', 'LAX-02'], ['Northside Storage', 'Chicago', 'CHI-03']].each do |name, city, code|
    db.execute('INSERT INTO warehouses(name,city,code,created_at) VALUES(?,?,?,?)', [name, city, code, now])
  end
  [
    ['Olivia Rhye', 'olivia@ravenstudio.co', 'Raven Studio'], ['Phoenix Baker', 'phoenix@acmestudio.com', 'Acme Studio'],
    ['Lana Steiner', 'lana@themodernhouse.com', 'The Modern House'], ['Demi Wilkinson', 'demi@northstar.design', 'Northstar Design'],
    ['Candice Wu', 'candice@atelierhome.co', 'Atelier Home'], ['Natali Craig', 'natali@formandfield.co', 'Form & Field']
  ].each { |name, email, company| db.execute('INSERT INTO customers(name,email,company,created_at) VALUES(?,?,?,?)', [name, email, company, now]) }
  products = [
    ['CH-1042', 'Sculpted oak chair', 1, 'Solid white oak, hand-finished with a natural oil. Made for slow dinners and long conversations.', 485, 12, 'piece', '#ddd7c9'],
    ['TB-2081', 'Arc floor lamp', 2, 'A quiet statement in brushed brass and opal glass.', 640, 8, 'piece', '#e4d3b0'],
    ['TX-3104', 'Woven linen throw', 4, 'European flax linen, stonewashed for an easy, lived-in feel.', 198, 20, 'piece', '#d6c6c1'],
    ['TW-0028', 'Ripple ceramic set', 3, 'Four hand-thrown stoneware cups in a soft chalk glaze.', 96, 15, 'set', '#cbd8d2'],
    ['CH-1058', 'Forma side table', 1, 'A sculptural side table with a gently rounded walnut top.', 720, 6, 'piece', '#c9b99f'],
    ['LT-4082', 'Dune table lamp', 2, 'An earthy ceramic base topped with a natural cotton shade.', 325, 10, 'piece', '#d9c6a5'],
    ['TX-3122', 'Cloud cotton cushion', 4, 'Soft, textured cotton cover with responsibly sourced down.', 84, 24, 'piece', '#e2d8cf'],
    ['TW-0056', 'Tide serving bowl', 3, 'A generous stoneware bowl, finished by hand in deep sea glaze.', 148, 10, 'piece', '#a9c1bb'],
    ['CH-1091', 'Studio bench', 1, 'A simple solid ash bench with joinery you can see and feel.', 890, 5, 'piece', '#d8cbb9'],
    ['LT-4118', 'Paper pendant', 2, 'A softly diffused pendant in pleated, handmade paper.', 420, 8, 'piece', '#e8dfcc']
  ]
  products.each do |p|
    db.execute('INSERT INTO products(sku,name,category_id,description,price,reorder_level,unit,accent,created_at) VALUES(?,?,?,?,?,?,?,?,?)', p + [now])
  end
  stocks = [[1,1,18],[1,2,7],[1,3,4],[2,1,5],[2,2,8],[2,3,3],[3,1,6],[3,2,11],[3,3,8],[4,1,32],[4,2,22],[4,3,16],[5,1,3],[5,2,2],[5,3,2],[6,1,14],[6,2,7],[6,3,5],[7,1,19],[7,2,17],[7,3,12],[8,1,8],[8,2,6],[8,3,5],[9,1,3],[9,2,2],[9,3,1],[10,1,9],[10,2,6],[10,3,4]]
  stocks.each do |product_id, warehouse_id, quantity|
    db.execute('INSERT INTO inventory(product_id,warehouse_id,quantity,updated_at) VALUES(?,?,?,?)', [product_id, warehouse_id, quantity, now])
    db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)', [product_id, warehouse_id, quantity, 'Opening stock', 'SEED', now])
  end
  seed_orders = [
    [1,1,0,'Delivered',[[1,2],[4,4]]], [2,2,1,'Processing',[[2,1],[3,2]]], [3,1,2,'Shipped',[[5,1]]],
    [4,3,3,'Delivered',[[7,6],[8,2]]], [5,1,4,'Processing',[[6,1],[4,2]]], [1,2,6,'Delivered',[[3,3],[10,1]]],
    [6,1,8,'Cancelled',[[1,1]]], [2,3,10,'Shipped',[[8,2],[7,2]]], [3,1,13,'Delivered',[[2,1],[6,1]]], [4,2,18,'Processing',[[5,1],[9,1]]]
  ]
  seed_orders.each_with_index do |(customer_id, warehouse_id, days, status, items), index|
    created = (Time.now.utc - days * 86_400).then { |time| Time.utc(time.year, time.month, time.day, 9 + (index + 1) % 8).iso8601 }
    order_number = "ST-#{Time.now.strftime('%y%m')}-#{format('%04d', index + 1)}"
    total = items.sum { |product_id, qty| first(db, 'SELECT price FROM products WHERE id=?', [product_id])['price'] * qty }
    db.execute('INSERT INTO orders(order_number,customer_id,warehouse_id,status,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', [order_number,customer_id,warehouse_id,status,total,created,created])
    order_id = db.last_insert_row_id
    items.each do |product_id, quantity|
      price = first(db, 'SELECT price FROM products WHERE id=?', [product_id])['price']
      db.execute('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)', [order_id,product_id,quantity,price])
      next if status == 'Cancelled'
      db.execute('UPDATE inventory SET quantity=MAX(0,quantity-?),updated_at=? WHERE product_id=? AND warehouse_id=?', [quantity,created,product_id,warehouse_id])
      db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)', [product_id,warehouse_id,-quantity,'Order placed',order_number,created])
    end
  end
end

class StockroomServlet < WEBrick::HTTPServlet::AbstractServlet
  def role(req)
    req['X-Role'].to_s.downcase == 'customer' ? 'customer' : 'admin'
  end

  def customer_id
    1
  end

  def service(req, res)
    result = route(req)
    status, data, type = result.is_a?(Array) && result.first.is_a?(Integer) ? result : [200, result, 'application/json; charset=utf-8']
    type ||= 'application/json; charset=utf-8'
    res.status = status
    res['Content-Type'] = type
    res['Cache-Control'] = 'no-store' if type.start_with?('application/json')
    res.body = type.start_with?('application/json') ? JSON.generate(data) : data
  rescue APIError => e
    json(res, { error: e.message }, e.status)
  rescue SQLite3::ConstraintException => e
    message = e.message.include?('FOREIGN KEY') ? 'Choose a category, warehouse and customer that exist.' : 'That name, email, SKU or code is already in use.'
    json(res, { error: message }, 409)
  rescue JSON::ParserError
    json(res, { error: 'Send a valid JSON body.' }, 400)
  rescue StandardError => e
    warn "Stockroom error: #{e.class}: #{e.message}\n#{e.backtrace&.first(4)&.join("\n")}"
    json(res, { error: 'Something went wrong. Please try again.' }, 500)
  end

  def json(res, payload, status = 200)
    res.status = status
    res['Content-Type'] = 'application/json; charset=utf-8'
    res['Cache-Control'] = 'no-store'
    res.body = JSON.generate(payload)
  end

  def route(req)
    path = req.path
    method = req.request_method
    return static(path) unless path.start_with?('/api/')
    body = %w[POST PATCH PUT].include?(method) ? parse_body(req) : {}
    database do |db|
      case [method, path]
      when ['GET', '/api/health'] then { ok: true, role: role(req) }
      when ['GET', '/api/overview'] then overview(db, req)
      when ['GET', '/api/products'] then product_rows(db)
      when ['GET', '/api/categories'] then rows(db, 'SELECT c.*,COUNT(p.id) product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.name')
      when ['GET', '/api/warehouses'] then rows(db, 'SELECT w.*,COUNT(DISTINCT CASE WHEN i.quantity>0 THEN i.product_id END) product_count,COALESCE(SUM(i.quantity),0) total_units FROM warehouses w LEFT JOIN inventory i ON i.warehouse_id=w.id GROUP BY w.id ORDER BY w.name')
      when ['GET', '/api/inventory'] then inventory_rows(db)
      when ['GET', '/api/customers']
        admin!(req)
        rows(db, "SELECT c.*,COUNT(o.id) order_count,COALESCE(SUM(CASE WHEN o.status!='Cancelled' THEN o.total ELSE 0 END),0) lifetime_value FROM customers c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY c.name")
      when ['GET', '/api/orders'] then order_rows(db, role(req) == 'customer' ? customer_id : nil)
      when ['GET', '/api/reports']
        admin!(req)
        reports(db, req.query['period'])
      when ['POST', '/api/orders'] then [201, create_order(db, req, body)]
      when ['POST', '/api/products']
        admin!(req)
        [201, create_product(db, body)]
      when ['POST', '/api/categories']
        admin!(req)
        name = text(body, 'name', 2, 50); color = text(body, 'color', 4, 20, true) || '#a7b9a7'
        db.execute('INSERT INTO categories(name,color,created_at) VALUES(?,?,?)', [name,color,Time.now.utc.iso8601])
        [201, first(db,'SELECT * FROM categories WHERE id=?',[db.last_insert_row_id])]
      when ['POST', '/api/warehouses']
        admin!(req)
        name=text(body,'name',2,80); city=text(body,'city',2,60); code=text(body,'code',2,20).upcase
        db.execute('INSERT INTO warehouses(name,city,code,created_at) VALUES(?,?,?,?)',[name,city,code,Time.now.utc.iso8601])
        [201,first(db,'SELECT * FROM warehouses WHERE id=?',[db.last_insert_row_id])]
      when ['POST', '/api/inventory/adjust']
        admin!(req)
        [201, adjust_stock(db,body)]
      when ['POST', '/api/customers']
        admin!(req)
        name=text(body,'name',2,100); email=text(body,'email',5,160).downcase
        raise APIError, 'Enter a valid customer email address.' unless email.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/)
        company=text(body,'company',0,100,true)||''
        db.execute('INSERT INTO customers(name,email,company,created_at) VALUES(?,?,?,?)',[name,email,company,Time.now.utc.iso8601])
        [201,first(db,'SELECT * FROM customers WHERE id=?',[db.last_insert_row_id])]
      else
        if method == 'GET' && (match=path.match(%r{\A/api/orders/(\d+)\z}))
          found=order_rows(db,role(req)=='customer' ? customer_id : nil,match[1].to_i)
          raise APIError.new('Order not found.',404) if found.empty?
          found.first
        elsif method == 'PATCH' && (match=path.match(%r{\A/api/orders/(\d+)\z}))
          id=match[1].to_i
          if role(req)=='customer'
            order=first(db,'SELECT customer_id,status FROM orders WHERE id=?',[id])
            raise APIError.new('Order not found.',404) unless order
            raise APIError.new('You can only update your own orders.',403) unless order['customer_id']==customer_id
            unless body['status']=='Cancelled' && order['status']=='Processing'
              raise APIError.new('Customers can cancel their own processing orders only.',403)
            end
          end
          change_order_status(db,id,body['status'])
        elsif method == 'PATCH' && (match=path.match(%r{\A/api/products/(\d+)\z}))
          admin!(req); update_product(db,match[1].to_i,body)
        else
          raise APIError.new('Route not found.',404)
        end
      end
    end
  end

  def database
    db=db_connect
    result=yield db
    db.execute('COMMIT') if db.transaction_active?
    result
  rescue StandardError
    db.execute('ROLLBACK') if db&.transaction_active?
    raise
  ensure
    db&.close
  end

  def parse_body(req)
    raise APIError.new('Request is too large.',413) if req.body.to_s.bytesize > 1_000_000
    JSON.parse(req.body.to_s.empty? ? '{}' : req.body)
  rescue JSON::ParserError
    raise APIError, 'Send a valid JSON body.'
  end

  def admin!(req)
    raise APIError.new('This action is available to administrators only.',403) unless role(req)=='admin'
  end

  def text(body,key,min,max,optional=false)
    value=body[key]
    return nil if value.nil? && optional
    raise APIError, "#{key.tr('_',' ').capitalize} is required." unless value.is_a?(String)
    value=value.strip
    raise APIError, "#{key.tr('_',' ').capitalize} must be #{min}–#{max} characters." unless value.length.between?(min,max)
    value
  end

  def integer(body,key,min,max=2_147_483_647,optional=false,default=nil)
    value=body.key?(key) ? body[key] : default
    return default if value.nil? && optional
    unless value.is_a?(Numeric) && value.to_i==value && !value.is_a?(TrueClass) && !value.is_a?(FalseClass)
      raise APIError, "#{key.tr('_',' ').capitalize} must be a whole number."
    end
    value=value.to_i
    raise APIError, "#{key.tr('_',' ').capitalize} must be between #{min} and #{max}." unless value.between?(min,max)
    value
  end

  def number(body,key,min=0)
    value=body[key]
    raise APIError, "#{key.tr('_',' ').capitalize} must be a number." unless value.is_a?(Numeric)
    raise APIError, "#{key.tr('_',' ').capitalize} cannot be negative." if value < min
    value.round(2)
  end

  def product_rows(db)
    rows(db,<<~SQL)
      SELECT p.*,c.name category,c.color category_color,COALESCE(SUM(i.quantity),0) stock,
      COALESCE(SUM(i.quantity)*p.price,0) stock_value,COUNT(DISTINCT CASE WHEN i.quantity>0 THEN i.warehouse_id END) warehouse_count
      FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN inventory i ON i.product_id=p.id
      GROUP BY p.id ORDER BY p.name
    SQL
  end

  def inventory_rows(db)
    rows(db,<<~SQL)
      SELECT i.product_id,i.warehouse_id,i.quantity,i.updated_at,p.sku,p.name product_name,p.reorder_level,p.unit,p.price,p.accent,
      c.name category,w.name warehouse_name,w.city warehouse_city,
      (SELECT COALESCE(SUM(ix.quantity),0) FROM inventory ix WHERE ix.product_id=p.id) total_stock
      FROM inventory i JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id
      JOIN warehouses w ON w.id=i.warehouse_id ORDER BY p.name,w.name
    SQL
  end

  def order_rows(db, customer = nil, order_id = nil)
    sql="SELECT o.*,c.name customer_name,c.email customer_email,c.company customer_company,w.name warehouse_name,w.city warehouse_city FROM orders o JOIN customers c ON c.id=o.customer_id JOIN warehouses w ON w.id=o.warehouse_id"
    clauses=[]; params=[]
    if customer; clauses << 'o.customer_id=?'; params << customer; end
    if order_id; clauses << 'o.id=?'; params << order_id; end
    sql += " WHERE #{clauses.join(' AND ')}" unless clauses.empty?
    sql += ' ORDER BY o.created_at DESC,o.id DESC'
    rows(db,sql,params).map do |order|
      order['items']=rows(db,<<~SQL,[order['id']])
        SELECT oi.product_id,p.name product_name,p.sku,oi.quantity,oi.unit_price,oi.quantity*oi.unit_price line_total
        FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?
      SQL
      order
    end
  end

  def overview(db, req)
    if role(req)=='customer'
      orders=order_rows(db,customer_id)
      active=orders.count { |o| %w[Processing Shipped].include?(o['status']) }
      month=orders.select { |o| o['status']!='Cancelled' && o['created_at'][0,7]==Date.today.strftime('%Y-%m') }.sum { |o| o['total'] }
      return {sales_this_month:month,sales_change_pct:0,units_in_stock:product_rows(db).sum { |p| p['stock'] },low_stock_count:0,active_orders:active,active_customers:0,recent_orders:orders.first(6),sales_trend:[],low_stock_products:[],total_products:first(db,'SELECT COUNT(*) n FROM products')['n'],total_warehouses:first(db,'SELECT COUNT(*) n FROM warehouses')['n'],customer_order_count:orders.length}
    end
    today=Date.today; first_day=today.strftime('%Y-%m-01'); prev_end=Date.parse(first_day)-1; prev_start=prev_end.strftime('%Y-%m-01')
    month_sales=first(db,"SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='Cancelled' AND date(created_at)>=?",[first_day])['n']
    prev_sales=first(db,"SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='Cancelled' AND date(created_at) BETWEEN ? AND ?",[prev_start,prev_end.iso8601])['n']
    units=first(db,'SELECT COALESCE(SUM(quantity),0) n FROM inventory')['n']
    low=first(db,'SELECT COUNT(*) n FROM products p WHERE (SELECT COALESCE(SUM(quantity),0) FROM inventory i WHERE i.product_id=p.id)<=p.reorder_level')['n']
    active=first(db,"SELECT COUNT(*) n FROM orders WHERE status IN ('Processing','Shipped')")['n']
    customers=first(db,"SELECT COUNT(DISTINCT customer_id) n FROM orders WHERE date(created_at)>=date('now','-30 day') AND status!='Cancelled'")['n']
    trend=rows(db,<<~SQL)
      WITH RECURSIVE days(day,n) AS (SELECT date('now','-6 day'),0 UNION ALL SELECT date(day,'+1 day'),n+1 FROM days WHERE n<6)
      SELECT day,COALESCE(SUM(CASE WHEN o.status!='Cancelled' THEN o.total END),0) sales
      FROM days LEFT JOIN orders o ON date(o.created_at)=days.day GROUP BY day ORDER BY day
    SQL
    alerts=product_rows(db).select { |p| p['stock']<=p['reorder_level'] }
    {sales_this_month:month_sales,sales_change_pct:prev_sales.to_f.zero? ? 0 : (((month_sales-prev_sales)/prev_sales.to_f)*100).round(1),units_in_stock:units,low_stock_count:low,active_orders:active,active_customers:customers,recent_orders:order_rows(db).first(6),sales_trend:trend,low_stock_products:alerts.first(5),total_products:first(db,'SELECT COUNT(*) n FROM products')['n'],total_warehouses:first(db,'SELECT COUNT(*) n FROM warehouses')['n']}
  end

  def reports(db, period)
    period=%w[7d 30d 90d 12m].include?(period) ? period : '7d'; days={'7d'=>7,'30d'=>30,'90d'=>90,'12m'=>365}[period]; start=(Date.today-days+1).iso8601
    daily=rows(db,<<~SQL,[start,days-1])
      WITH RECURSIVE days(day,n) AS (SELECT date(?),0 UNION ALL SELECT date(day,'+1 day'),n+1 FROM days WHERE n<?)
      SELECT day,COALESCE(SUM(CASE WHEN o.status!='Cancelled' THEN o.total END),0) sales,
      COUNT(DISTINCT CASE WHEN o.status!='Cancelled' THEN o.id END) orders
      FROM days LEFT JOIN orders o ON date(o.created_at)=days.day GROUP BY day ORDER BY day
    SQL
    categories=rows(db,<<~SQL,[start])
      SELECT c.id,c.name,c.color,COALESCE(SUM(oi.quantity*oi.unit_price),0) sales,COALESCE(SUM(oi.quantity),0) units
      FROM categories c LEFT JOIN products p ON p.category_id=c.id LEFT JOIN order_items oi ON oi.product_id=p.id
      LEFT JOIN orders o ON o.id=oi.order_id AND o.status!='Cancelled' AND date(o.created_at)>=?
      WHERE o.id IS NOT NULL GROUP BY c.id ORDER BY sales DESC
    SQL
    top=rows(db,<<~SQL,[start])
      SELECT p.name,p.sku,SUM(oi.quantity) units,SUM(oi.quantity*oi.unit_price) sales FROM order_items oi
      JOIN products p ON p.id=oi.product_id JOIN orders o ON o.id=oi.order_id
      WHERE o.status!='Cancelled' AND date(o.created_at)>=? GROUP BY p.id ORDER BY sales DESC LIMIT 5
    SQL
    summary=first(db,"SELECT COALESCE(SUM(total),0) sales,COUNT(*) orders,COUNT(DISTINCT customer_id) customers FROM orders WHERE status!='Cancelled' AND date(created_at)>=?",[start])
    {period:period,start_date:start,summary:summary,daily:daily,categories:categories,top_products:top}
  end

  def create_order(db, req, body)
    customer=role(req)=='customer' ? customer_id : integer(body,'customer_id',1)
    warehouse=integer(body,'warehouse_id',1); items=body['items']
    raise APIError, 'Add at least one product to the order.' unless items.is_a?(Array) && !items.empty? && items.length<=50
    normalized={}
    items.each do |item|
      raise APIError, 'Each order line must include a product and quantity.' unless item.is_a?(Hash)
      pid=integer(item,'product_id',1); qty=integer(item,'quantity',1,10000); normalized[pid]=(normalized[pid]||0)+qty
    end
    db.execute('BEGIN IMMEDIATE')
    raise APIError, 'Choose a customer that exists.' unless first(db,'SELECT 1 ok FROM customers WHERE id=?',[customer])
    raise APIError, 'Choose a warehouse that exists.' unless first(db,'SELECT 1 ok FROM warehouses WHERE id=?',[warehouse])
    details=[]; total=0
    normalized.each do |pid,qty|
      product=first(db,'SELECT id,name,sku,price FROM products WHERE id=?',[pid])
      raise APIError, 'One of the selected products no longer exists.' unless product
      stock=first(db,'SELECT quantity FROM inventory WHERE product_id=? AND warehouse_id=?',[pid,warehouse])
      available=stock ? stock['quantity'] : 0
      raise APIError.new("Only #{available} #{product['name']} available at this warehouse.",409) if available<qty
      total+=product['price']*qty; details << [product,qty]
    end
    now=Time.now.utc.iso8601
    order_number="ST-#{Time.now.strftime('%y%m')}-#{Time.now.strftime('%H%M%S%L')}"
    db.execute("INSERT INTO orders(order_number,customer_id,warehouse_id,status,total,created_at,updated_at) VALUES(?,?,?,'Processing',?,?,?)",[order_number,customer,warehouse,total,now,now])
    order_id=db.last_insert_row_id
    details.each do |product,qty|
      db.execute('UPDATE inventory SET quantity=quantity-?,updated_at=? WHERE product_id=? AND warehouse_id=?',[qty,now,product['id'],warehouse])
      db.execute('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)',[order_id,product['id'],qty,product['price']])
      db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)',[product['id'],warehouse,-qty,'Order placed',order_number,now])
    end
    order_rows(db,role(req)=='customer' ? customer_id : nil,order_id).first
  end

  def create_product(db, body)
    sku=text(body,'sku',2,30).upcase; name=text(body,'name',2,100); category=integer(body,'category_id',1); price=number(body,'price')
    reorder=integer(body,'reorder_level',0,2_147_483_647,true,10); unit=text(body,'unit',1,20,true)||'unit'; description=text(body,'description',0,500,true)||''; accent=text(body,'accent',4,20,true)||'#dce5df'
    raise APIError, 'Choose a category that exists.' unless first(db,'SELECT 1 ok FROM categories WHERE id=?',[category])
    initial=integer(body,'initial_stock',0,2_147_483_647,true,0); warehouse=initial>0 ? integer(body,'warehouse_id',1) : nil; now=Time.now.utc.iso8601
    db.execute('BEGIN IMMEDIATE')
    db.execute('INSERT INTO products(sku,name,category_id,description,price,reorder_level,unit,accent,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[sku,name,category,description,price,reorder,unit,accent,now])
    product_id=db.last_insert_row_id
    db.execute('INSERT INTO inventory(product_id,warehouse_id,quantity,updated_at) SELECT ?,id,0,? FROM warehouses',[product_id,now])
    if initial>0
      db.execute('UPDATE inventory SET quantity=?,updated_at=? WHERE product_id=? AND warehouse_id=?',[initial,now,product_id,warehouse])
      db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)',[product_id,warehouse,initial,'Initial stock','PRODUCT',now])
    end
    product_rows(db).find { |p| p['id']==product_id }
  end

  def update_product(db,id,body)
    raise APIError.new('Product not found.',404) unless first(db,'SELECT 1 ok FROM products WHERE id=?',[id])
    sku=text(body,'sku',2,30).upcase; name=text(body,'name',2,100); category=integer(body,'category_id',1); price=number(body,'price'); reorder=integer(body,'reorder_level',0); unit=text(body,'unit',1,20); description=text(body,'description',0,500,true)||''; accent=text(body,'accent',4,20)
    raise APIError, 'Choose a category that exists.' unless first(db,'SELECT 1 ok FROM categories WHERE id=?',[category])
    db.execute('UPDATE products SET sku=?,name=?,category_id=?,description=?,price=?,reorder_level=?,unit=?,accent=? WHERE id=?',[sku,name,category,description,price,reorder,unit,accent,id])
    product_rows(db).find { |p| p['id']==id }
  end

  def adjust_stock(db,body)
    pid=integer(body,'product_id',1); wid=integer(body,'warehouse_id',1); change=integer(body,'change',-100000,100000)
    raise APIError, 'Enter a quantity change greater or less than zero.' if change.zero?
    reason=text(body,'reason',2,80); now=Time.now.utc.iso8601; db.execute('BEGIN IMMEDIATE')
    raise APIError, 'Choose a product and warehouse that exist.' unless first(db,'SELECT 1 ok FROM products WHERE id=?',[pid]) && first(db,'SELECT 1 ok FROM warehouses WHERE id=?',[wid])
    db.execute('INSERT OR IGNORE INTO inventory(product_id,warehouse_id,quantity,updated_at) VALUES(?,?,0,?)',[pid,wid,now])
    current=first(db,'SELECT quantity FROM inventory WHERE product_id=? AND warehouse_id=?',[pid,wid])['quantity']
    raise APIError.new("Only #{current} units are available to remove.",409) if current+change<0
    db.execute('UPDATE inventory SET quantity=quantity+?,updated_at=? WHERE product_id=? AND warehouse_id=?',[change,now,pid,wid])
    db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)',[pid,wid,change,reason,'MANUAL',now])
    {product_id:pid,warehouse_id:wid,quantity:current+change}
  end

  def change_order_status(db,id,status)
    raise APIError, 'Choose a valid order status.' unless %w[Processing Shipped Delivered Cancelled].include?(status)
    db.execute('BEGIN IMMEDIATE')
    order=first(db,'SELECT * FROM orders WHERE id=?',[id]); raise APIError.new('Order not found.',404) unless order
    allowed={'Processing'=>%w[Shipped Cancelled],'Shipped'=>%w[Delivered Cancelled],'Delivered'=>[],'Cancelled'=>[]}
    unless allowed[order['status']].include?(status)
      raise APIError.new("An order marked #{order['status'].downcase} cannot be changed to #{status.downcase}.",409)
    end
    now=Time.now.utc.iso8601
    if status=='Cancelled'
      rows(db,'SELECT product_id,quantity FROM order_items WHERE order_id=?',[id]).each do |item|
        db.execute('INSERT OR IGNORE INTO inventory(product_id,warehouse_id,quantity,updated_at) VALUES(?,?,0,?)',[item['product_id'],order['warehouse_id'],now])
        db.execute('UPDATE inventory SET quantity=quantity+?,updated_at=? WHERE product_id=? AND warehouse_id=?',[item['quantity'],now,item['product_id'],order['warehouse_id']])
        db.execute('INSERT INTO stock_movements(product_id,warehouse_id,change,reason,reference,created_at) VALUES(?,?,?,?,?,?)',[item['product_id'],order['warehouse_id'],item['quantity'],'Order cancelled · stock returned',order['order_number'],now])
      end
    end
    db.execute('UPDATE orders SET status=?,updated_at=? WHERE id=?',[status,now,id])
    order_rows(db,nil,id).first
  end

  def static(path)
    relative=path=='/' ? 'index.html' : path.sub(%r{\A/},'')
    candidate=ROOT.join(relative).cleanpath
    raise APIError.new('Not found.',404) unless candidate.to_s.start_with?(ROOT.to_s + '/') && candidate.file?
    content={' .html'=>'text/html; charset=utf-8','.html'=>'text/html; charset=utf-8','.css'=>'text/css; charset=utf-8','.js'=>'text/javascript; charset=utf-8','.svg'=>'image/svg+xml'}[candidate.extname] || 'application/octet-stream'
    [200,File.binread(candidate),content]
  end
end

init_db
server=WEBrick::HTTPServer.new(Port:PORT,BindAddress:BIND_ADDRESS,AccessLog:[],Logger:WEBrick::Log.new($stdout,WEBrick::Log::INFO))
server.mount('/',StockroomServlet)
trap('INT'){server.shutdown}; trap('TERM'){server.shutdown}
puts "Stockroom is ready at http://localhost:#{PORT}"
puts "SQLite database: #{DB_PATH}"
server.start
