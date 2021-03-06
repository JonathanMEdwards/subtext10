import { compile, expectCompiling, expectErrors, off } from './exports';

test('write update', () => {
  let w = compile("a: 0");
  w.writeAt('a', 1);
  expect(w.dumpAt('a')).toEqual(1);
  expect(() => { w.writeAt('a', 'foo') }).toThrow('edit error: type')
});

test('choice update', () => {
  let w = compile("a: choice{x?: 0; y?: 'foo'}");
  w.updateAt('a', '#y()');
  w.writeAt('a.y', 'bar');
  expect(w.dumpAt('a')).toEqual({y: 'bar'});
});

test('create update', () => {
  let w = compile("a: array{0}");
  w.createAt('a');
  expect(w.dumpAt('a')).toEqual([0]);
});

test('delete update', () => {
  let w = compile("a: array{###} & 1 & 2");
  w.deleteAt('a', 1);
  expect(w.dumpAt('a')).toEqual([2]);
});

test('update readonly', () => {
  let w = compile("a = 0");
  expect(() => { w.writeAt('a', 1) }).toThrow('not updatable')
});

test('update type check', () => {
  let w = compile("a: 0");
  expect(() => { w.writeAt('a', 'foo') }).toThrow('edit error: type')
});

test('interface', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32 on-update{write - 32 / 1.8 -> c}");
  expect(w.dumpAt('f')).toEqual(32);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('incrementer', () => {
  let w = compile(`
  c: 0
  button =|> off on-update{write c <- +1}`);
  w.turnOn('button');
  expect(w.dumpAt('c')).toEqual(1);
});

test('update error', () => {
  let w = compile(`
  c: 0
  button =|> off on-update{write c <- ''}`);
  expect(()=>w.turnOn('button')).toThrow('edit error: type')
});

test('internal incrementer', () => {
  let w = compile(`
  r = record {
    c: 0
    button =|> off on-update{write c <- + 1}
  }
  s = r with{.button := #on()}
  `);
  expect(w.dumpAt('s')).toEqual({c: 1, button: off});
});

test('internal update error', () => {
  expectErrors(`
  r = record {
    c: 0
    button =|> off on-update{write c <- ''}
  }
  s = r with{.button := #on()}
  `).toContain('s: type')
});

test('function on-update', () => {
  let w = compile(`
  c: 0,
  f = do {
    in: 0
    + 1
    on-update { write 1 -> in}
  }
  g =|> c f()
  `);
  expect(w.dumpAt('g')).toEqual(1);
  w.writeAt('g', 212);
  expect(w.dumpAt('c')).toEqual(1);
});

test('reverse formula', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32");
  expect(w.dumpAt('f')).toEqual(32);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('literal update', () => {
  expect(() => compile("c: 0, f =|> 0"))
    .toThrow('not updatable');
});

test('constant formula update', () => {
  expect(() => compile("c: 0, f =|> 0 * 1.8 + 32"))
    .toThrow('not updatable');
});

test('update propagation', () => {
  let w = compile(`
  s = record {
    c: 0;
    f =|> c * 1.8 + 32 on-update{write - 32 / 1.8 -> c}
  }
  t = .f := 212
  u = s with{.f := 212}`);
  expect(w.dumpAt('t')).toEqual({c: 100, f: 212});
  expect(w.dumpAt('u')).toEqual({c: 100, f: 212});
});

test('internal reverse formula', () => {
  let w = compile(`
  s = record {
    c: 0;
    f =|> c * 1.8 + 32
  }
  t = .f := 212
  u = s with{.f := 212}`);
  expect(w.dumpAt('s')).toEqual({c: 0, f: 32});
  expect(w.dumpAt('t')).toEqual({c: 100, f: 212});
  expect(w.dumpAt('u')).toEqual({c: 100, f: 212});
});

test('write type check', () => {
  expectErrors("c: 0, f =|> c on-update{write 'foo' -> c}")
    .toContain('f.^code.6.7: type');
});

test('write order check', () => {
  expectCompiling("c: 0, f =|> c on-update{write -> g}, g: 0")
    .toThrow('write must go backwards');
});

test('write context check', () => {
  expectCompiling(`
  a: 0
  s = record {
    c: 0
    f =|> c on-update{write -> a}
  }
  t = s with{.f := 1}
  `).toThrow('write outside context of update');
  expectCompiling(`
  a: 0
  s = record {
    c: 0
    f =|> a
  }
  t = s with{.f := 1}
  `).toThrow('write outside context of update');
});

test('conditional on-update', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 on-update{
    try {
      check 1 =? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('conditional on-update 2', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 on-update{
    try {
      check 1 not=? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(50);
});

test('conditional on-update merging writes', () => {
  let w = compile(`
  c: record{x: 0, y: 0}
  f =|> c.x on-update{
    try {
      check 1 not=? 2
      write c <- with{.x := 1}
      nil
    }
    else {
      write 1 -> c.x
      nil
    }
  }`);
  w.writeAt('f', 1);
  expect(w.dumpAt('c.x')).toEqual(1);
});

test('conditional on-update in update', () => {
  // tricky because of analysis deferral
  let w = compile(`
  s = record {
    c: 0
    f =|> c * 1.8 + 32 on-update{
      try {
        check 1 =? 2
        write 50 -> c
      }
      else {
        write - 32 / 1.8 -> c
      }
    }
  }
  t = s with{.f := 212}
  `);
  expect(w.dumpAt('t.c')).toEqual(100);
});

test('reverse conditional update', () => {
  let w = compile(`
  c: 0
  f =|> do{
    try {
      check 1 =? 2
      c + 1
    }
    else {
      c + 2
    }
  }`);
  w.writeAt('f', 100);
  expect(w.dumpAt('c')).toEqual(98);
});

test('reverse conditional update 2', () => {
  let w = compile(`
  c: 0
  f =|> do{
    try {
      check 1 not=? 2
      c + 1
    }
    else {
      c + 2
    }
  }`);
  w.writeAt('f', 100);
  expect(w.dumpAt('c')).toEqual(99);
});


test('update aggregation', () => {
  let w = compile(`
  s: record {
    c: 0
    d: 0
  }
  t =|> s`);
  w.writeAt('t.c', 100);
  expect(w.dumpAt('s')).toEqual({c: 100, d: 0});
})

test('update aggregation 2', () => {
  let w = compile(`
  s: record {
    c: 0
    d =|> c
  }
  t =|> s`);
  w.writeAt('t.d', 100);
  expect(w.dumpAt('s')).toEqual({c: 100, d: 100});
})

test('moot update', () => {
  let w = compile("c: 0, f =|> off on-update{write c <- + 1}");
  w.turnOn('f');
  expect(w.dumpAt('c')).toEqual(1);
  w.updateAt('f', '#off()');
  expect(w.dumpAt('c')).toEqual(1);
});

test('equal write', () => {
  expectCompiling(`
  c: 0
  d = record{x = c}
  f =|> off on-update{write d.x -> c}
  `).toThrow('writing same value');
});

test('try breaks provenance', () => {
  let w = compile(`
  c: 0
  d = try {check 1 =? 1; c} else {c}
  f =|> off on-update{write c <- d}
  `);
  w.turnOn('f');
  expect(w.dumpAt('c')).toEqual(0);
});

test('update order', () => {
  let w = compile(`
  c: 0
  f =|> record{x: 0, y: 0} on-update{
    write c <- +(change.x) +(change.y)
  }
  g =|> off on-update{write 1 -> f.x; write 1 -> f.y}
  `);
  w.turnOn('g');
  expect(w.dumpAt('c')).toEqual(2);
});

test('input write conflict', () => {
  expectCompiling(`
  f: record{x: 0, y: 0}
  g =|> off on-update{write 1 -> f.x; write f <- with{.y := 1}}
  `).toThrow('write conflict')
});

test('interface write conflict', () => {
  expectCompiling(`
  e: record{x: 0, y: 0}
  f =|> e
  g =|> off on-update{write 1 -> f.x; write f <- with{.y := 1}}
  `).toThrow('write conflict')
});

test('overwrite', () => {
  expectCompiling(`
  c: 0
  g =|> off on-update{write 1 -> c; write 2 -> c}
  `).toThrow('write conflict');
});

test('forked overwrite', () => {
  expectCompiling(`
    c: 0
    f =|> off on-update{write c <- 1}
    g =|> off on-update{write c <- 2}
    h =|> off on-update{write f <- on, write g <- on}
  `).toThrow('write conflict');
});

test('reverse update', () => {
  let w = compile(`
  u = record {
    a: 0
    b = record{x: 0, y: 0}
    c =|> b with{.x := a}
  }
  v = u with{.c.x := 1}
  `);
  expect(w.dumpAt('v.a')).toEqual(1);
  expect(w.dumpAt('v.b')).toEqual({x: 0, y: 0});
});

test('reverse update 2', () => {
  let w = compile(`
  u = record {
    b: record{x: 0, y: 0}
    c =|> b with{.x := 1}
  }
  v = u with{.c.y := 1}
  `);
  expect(w.dumpAt('v.b')).toEqual({x: 0, y: 1});
});

test('such-that', () => {
  let w = compile(`
  a : tracked array{###} & 1 & 2 & 3
  b =|> a such-that{ check not=? 2}
  `);
  expect(w.dumpAt('b')).toEqual([1, 3]);
  w.writeAt('b.1', 10);
  expect(w.dumpAt('a')).toEqual([10, 2, 3]);
  expect(w.dumpAt('b')).toEqual([10, 3]);
})

test('delete such-that', () => {
  let w = compile(`
  a : tracked array{###} & 1 & 2 & 3
  b =|> a such-that{ check not=? 2}
  `);
  w.deleteAt('b', 1)
  expect(w.dump()).toEqual({ a: [2, 3], b: [3] });
})

test('internal delete such-that', () => {
  let w = compile(`
  s = record{
    a : tracked array{###} & 1 & 2 & 3
    b =|> a such-that{ check not=? 2}
  }
  t = s with{.b := delete!(1)}
  `);
  expect(w.dumpAt('t')).toEqual({a: [2, 3], b: [3]});
})

test('create such-that', () => {
  let w = compile(`
  a : tracked array{0} & 1 & 2 & 3
  b =|> a such-that{ check not=? 2}
  `);
  w.createAt('b');
  expect(w.dump()).toEqual({a: [1, 2, 3, 0], b: [1, 3, 0]});
})

test('internal create such-that', () => {
  let w = compile(`
  s = record{
    a : tracked array{###} & 1 & 2 & 3
    b =|> a such-that{ check not=? 2}
  }
  t = s with{.b := & 10}
  `);
  expect(w.dumpAt('t')).toEqual({a: [1, 2, 3, 10], b: [1, 3, 10]});
})

test('for-all', () => {
  let w = compile(`
  a : tracked array{###} & 1 & 2 & 3
  b =|> a for-all{+ 1}
  `);
  expect(w.dumpAt('b')).toEqual([2, 3, 4]);
  w.writeAt('b.2', 11);
  expect(w.dumpAt('a')).toEqual([1, 10, 3]);
  expect(w.dumpAt('b')).toEqual([2, 11, 4]);
})

test('for-all with update', () => {
  let w = compile(`
  r: record {
    a : tracked array{###} & 1 & 2 & 3
    b =|> a for-all{+ 1}
  }
  s = r with{.b := update!(2, .value := 11) }
  `);
  expect(w.dumpAt('s')).toEqual({a: [1, 10, 3], b: [2, 11, 4]});
})

test('for-all with delete', () => {
  let w = compile(`
  r: record {
    a : tracked array{###} & 1 & 2 & 3
    b =|> a for-all{+ 1}
  }
  s = r with{.b := delete! 2 }
  `);
  expect(w.dumpAt('s')).toEqual({a: [1, 3], b: [2, 4]});
})

test('for-all with create', () => {
  let w = compile(`
  r: record {
    a : tracked array{###} & 1 & 2 & 3
    b =|> a for-all{+ 1}
  }
  s = r with{.b := & 11 }
  `);
  expect(w.dumpAt('s')).toEqual({a: [1, 2, 3, 10], b: [2, 3, 4, 11]});
})

test('for-all with noop create', () => {
  let w = compile(`
  r: record {
    a : tracked array{###} & 1 & 2 & 3
    b =|> a for-all{+ 1}
  }
  s = r with{.b := & 1 }
  `);
  expect(w.dumpAt('s')).toEqual({a: [1, 2, 3, 0], b: [2, 3, 4, 1]});
})

test('for-all with empty on-update', () => {
  let w = compile(`
  a : tracked array{###} & 1 & 2 & 3
  b =|> a for-all{on-update{1}}
  `);
  expect(w.dumpAt('b')).toEqual([1, 2, 3]);
  w.writeAt('b.2', 10);
  expect(w.dumpAt('a')).toEqual([1, 2, 3]);
})

test('for-all with on-update', () => {
  let w = compile(`
  a : tracked array{###} & 1 & 2 & 3
  b =|> a for-all{item:[]; on-update{write 1 -> item}}
  `);
  expect(w.dumpAt('b')).toEqual([1, 2, 3]);
  w.writeAt('b.2', 10);
  expect(w.dumpAt('a')).toEqual([1, 1, 3]);
})

test('for-all write encapsulation', () => {
  expectCompiling(`
  c : 0
  a : tracked array{###} & 1 & 2 & 3
  b =|> a for-all{item: []; on-update{write 1 -> item; write 1 -> c}}
  `).toThrow('external write from for-all')
})

test('for-all reference encapsulation', () => {
  expectCompiling(`
  c : 0
  a : tracked array{###} & 1 & 2 & 3
  b =|> a for-all{c}
  `).toThrow('external write from for-all')
})

test('updatable query', () => {
  let w = compile(`
  customers: do{
    tracked table{customer-id: ###}
    &{.customer-id:= 1}
    &{.customer-id:= 2}
  }
  orders: do{
    tracked table{order-id: ###, customer-id: ###}
    &{.order-id:= 1, .customer-id:= 1}
    &{.order-id:= 2, .customer-id:= 1}
  }

  query =|> customers for-all{
    extend{their-orders =|> orders such-that{.customer-id =? customer-id}}
  }
  `)

  expect(w.dumpAt('query')).toEqual([
    {
      'customer-id': 1,
      'their-orders': [
        { 'customer-id': 1, 'order-id': 1 },
        { 'customer-id': 1, 'order-id': 2 },
      ]
    },
    {
      'customer-id': 2,
      'their-orders':[],
    },
  ]);

  // update nested table
  w.writeAt('query.1.their-orders.2.customer-id', 2);
  expect(w.dumpAt('orders')).toEqual([
    { 'customer-id': 1, 'order-id': 1 },
    { 'customer-id': 2, 'order-id': 2 },
  ]);
  expect(w.dumpAt('query')).toEqual([
    {
      'customer-id': 1,
      'their-orders': [
        { 'customer-id': 1, 'order-id': 1 },
      ]
    },
    {
      'customer-id': 2,
      'their-orders': [
        { 'customer-id': 2, 'order-id': 2 },
      ],
    },
  ]);

  // delete from nested table
  w.deleteAt('query.2.their-orders', 1);
  expect(w.dumpAt('orders')).toEqual([
    { 'customer-id': 1, 'order-id': 1 },
  ]);

  // update containing table
  w.writeAt('query.2.customer-id', 3);
  expect(w.dumpAt('customers')).toEqual([
    { 'customer-id': 1 },
    { 'customer-id': 3 },
  ]);

  // delete from containing table
  w.deleteAt('query', 2);
  expect(w.dumpAt('customers')).toEqual([
    { 'customer-id': 1 },
  ]);

  // create in containing table
  w.createAt('query');
  w.writeAt('query.2.customer-id', 3);
  expect(w.dumpAt('customers')).toEqual([
    { 'customer-id': 1 },
    { 'customer-id': 3 },
  ]);

  // create in nested table
  w.createAt('query.1.their-orders');
  w.writeAt(`orders.2.order-id`, 3);
  w.writeAt(`orders.2.customer-id`, 1);
  expect(w.dumpAt('query')).toEqual([
    {
      'customer-id': 1,
      'their-orders': [
        { 'customer-id': 1, 'order-id': 1 },
        { 'customer-id': 1, 'order-id': 3 },
      ]
    },
    {
      'customer-id': 3,
      'their-orders': [],
    },
  ]);
})
test('query update context error', () => {
  expectCompiling(`
  customers: tracked table{customer-id: ###}
  orders: tracked table{order-id: ###, customer-id: ###}
  query =|> customers for-all{
    extend{their-orders =|> orders such-that{.customer-id =? customer-id}}
  }
  x = query &{.their-orders := &()}
  `)
    .toThrow('write outside context')
})

test('register', () => {
  let w = compile(`
  a: 'foo'
  v = with{
    item: that
    show-state: register yes
    record{
      value = try {
        check show-state.yes?
        item
      } else {
        ''
      }
      show =|> off on-update {write show-state <- flip()}
    }
  }
  `);
  expect(w.dump()).toEqual({ a: 'foo', v: { value: 'foo', show: off } });
  w.turnOn('v.show');
  expect(w.dump()).toEqual({ a: 'foo', v: { value: '', show: off } });
})

test('register iteration', () => {
  let w = compile(`
  a: tracked array{''} & 'foo' & 'bar' & 'baz'
  v = a for-all {
    item:[]
    show-state: register yes
    record{
      value = try {
        check show-state.yes?
        item
      } else {
        ''
      }
      show =|> off on-update {write show-state <- flip()}
    }
  }
  `);
  expect(w.dump()).toEqual({
    a: ['foo', 'bar', 'baz'],
    v: [
      { value: 'foo', show: off },
      { value: 'bar', show: off },
      { value: 'baz', show: off },
    ]
  });
  w.turnOn('v.2.show');
  expect(w.dump()).toEqual({
    a: ['foo', 'bar', 'baz'],
    v: [
      { value: 'foo', show: off },
      { value: '', show: off },
      { value: 'baz', show: off },
    ]
  });
  w.deleteAt('a', 1);
  expect(w.dump()).toEqual({
    a: ['bar', 'baz'],
    v: [
      { value: '', show: off },
      { value: 'baz', show: off },
    ]
  });
});

test('input reference hygiene', () => {
  expectCompiling(`
  a: tracked array{''} & 'foo' & 'bar' & 'baz'
  v: a for-all {
    item:[]
    show-state: register on
    record{
      value = try {
        check show-state =? on
        item
      } else {
        ''
      }
      show =|> off on-update {write show-state <- flip()}
    }
  }
  `).toThrow('input field value referencing its own formula');
});
