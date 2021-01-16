import { ID, RealID, Field, Reference, trap, assert, Token, cast, arrayLast, Text, assertDefined, _Number, _Array, Entry, Record, FieldID, Version, Nil, Base, Character, Head, isNumber, CompileError, Item } from "./exports";

/** evaluate edit operations */
export function edit(version: Version) {

  // get target path in input
  const targetRef = cast(version.get('^target').value, Reference);
  assert(targetRef.dependent);
  // get input version, which is context of reference
  const input = version.workspace.down(
    targetRef.path.ids.slice(0, targetRef.context)
  );

  // copy input to result value, to be edited as needed
  version.copyValue(input);
  const head = cast(version.value, Head);
  const versionPathLength = version.path.length;

  // erase edit errors for re-analysis, but keep conversion errors
  for (let item of head.visit()) {
    if (item.originalEditError !== 'conversion') {
      item.editError = undefined;
    }
  }

  // get target within result
  const targetPath = targetRef.path.ids.slice(targetRef.context);
  const target = version.down(targetPath)
  assert(target);
  // FIXME: only editing data fields for now
  assert(target.io === 'data');

  /** editor function to iterate */
  let editor: (item: Item) => void;

  /** post-edit cleanup function */
  let cleanup = () => { return; };

  /** Iterate edit over nested arrays */
  function iterateEdit(
    context: Item,
    path: ID[],
    editor: (item: Item) => void
  ) {
    // detect if target is inside an array entry or template
    let index = path.findIndex(isNumber);
    if (index >= 0) {
      // recurse on array template and items
      // MAYBE: lift edit in entry to template
      assert(path[index] === 0);
      let array = context.down(path.slice(0, index)).value;
      assert(array instanceof _Array);
      let arrayPath = path.slice(index + 1);
      // recurse on rest of path into template
      iterateEdit(array.template, arrayPath, editor);
      // edit array entries too
      array.items.forEach(item => iterateEdit(item, arrayPath, editor));
      return;
    }
    // editor target
    const target = context.down(path)
    editor(target);
  }

  /** copy from source to target. If target is inside an array entry, will
   * copy from its template instead. Includes source metadata. Does not change
   * target id or io. Returns actual source of copy */
  // FIXME is copying from template needed? create operation doesn't do that!
  // theoretically this could be integrated into iterateEdit
  function templateCopy(target: Item, source: Item): Item {
    let templatePath = source.path;
    let entryPath = target.path;
    // find lowest array entry containing target
    let ids = target.path.ids.slice(versionPathLength).reverse();
    let arrayIndex = ids.findIndex(id => isNumber(id) && id > 0);
    if (arrayIndex >= 0) {
      // copy from template, which should already have been copied from source
      let templateIds = target.path.ids.slice();
      assert(templateIds[templateIds.length - 1 - arrayIndex] > 0);
      templateIds[templateIds.length - 1 - arrayIndex] = 0;
      source = target.workspace.down(templateIds);
      templatePath = source.path.up(arrayIndex); // path to template
      assert(arrayLast(templatePath.ids) === 0);
      entryPath = target.path.up(arrayIndex); // path to entry
      assert(arrayLast(entryPath.ids) > 0);
    }
    // create copy of source and metadata
    let temp = source.copy(templatePath, entryPath);
    // substitute into target
    target.metadata = temp.metadata;
    if (target.metadata) target.metadata.containingItem = target;
    target.formulaType = temp.formulaType;
    target.detachValueIf();
    target.value = temp.value;
    if (target.value) target.value.containingItem = target;

    return source;
  }

  /** Disallow references outside literal value */
  // TODO: could convert references to literal values
  function literalCheck(literal: Item) {
    for (let item of literal.visit()) {
      if (item.value instanceof Reference
        && !literal.contains(item.value.target!)
      ) {
        throw new CompileError(item, 'reference escaping literal value');
      }
    }

  }

  switch (version.formulaType) {

    case '::replace': {
      // ^source is literal or reference
      const source = version.get('^source');
      // FIXME: don't want copy of reference to source
      if (source.value instanceof Reference) trap();
      literalCheck(source);
      // function to perform edit
      editor = (target: Item) => {
        templateCopy(target, source);
      }
      break;
    }

    case '::append': {
      if (!(target.value instanceof Record)) {
        throw new CompileError(target, 'can only append to record')
      }
      // ^source is Record containing field to append/insert
      const source = cast(version.get('^source').value, Record).fields[0];
      assert(source);
      literalCheck(source);

      // function to perform edit
      editor = (target: Item) => {
        let newField = new Field;
        cast(target.value, Record).add(newField);
        newField.id = source.id;
        newField.io = source.io;
        // FIXME: don't want copy of reference to source
        if (source.value instanceof Reference) trap();
        templateCopy(newField, source);
      }
      break;
    }

    case '::insert': {
      if (!(target.container instanceof Record)) {
        throw new CompileError(target, 'can only insert into record')
      }
      // ^source is Record containing field to append/insert
      const source = cast(version.get('^source').value, Record).fields[0];
      assert(source);
      literalCheck(source);

      // function to perform edit
      editor = (target: Item) => {
        let newField = new Field;
        newField.id = source.id;
        newField.io = source.io;
        let record = target.container as Record;
        newField.container = record;
        let i = record.fields.indexOf(target as Field);
        assert(i >= 0);
        record.fields.splice(i, 0, newField);
        // FIXME: don't want copy of reference to source
        if (source.value instanceof Reference) trap();
        templateCopy(newField, source);
      }
      break;
    }

    case '::delete': {
      if (!(target instanceof Field)) {
        throw new CompileError(target, 'can only delete a field')
      }

      editor = (item) => (item as Field).delete();
      break;
    }

    case '::move':
    case '::move-append':
    case '::move-insert': {
      // ^source is reference
      const sourceRef = cast(version.get('^source').value, Reference);
      if (!sourceRef.target) {
        throw new CompileError(undefined, 'invalid reference')
      }
      if (!(sourceRef.target instanceof Field)) {
        throw new CompileError(undefined, 'can only move a field')
      }

      // get source inside result
      assert(sourceRef.dependent);
      const x = version.down(sourceRef.path.ids.slice(sourceRef.context));
      assert(x instanceof Field);
      const source = x;

      // Check that source and target in same template
      const lubLength = target.path.lub(source.path).length;
      if (target.path.ids.slice(lubLength).find(isNumber)
        || source.path.ids.slice(lubLength).find(isNumber)
      ) {
        // TODO: allow movement through arrays
        trap();
      }
      // path from LUB to source
      const sourceSuffix = source.path.ids.slice(lubLength);

      let movedPath = target.path;

      /** perform move edit iterated over array entries by iteratedEdit */
      function templateMove(to: Item, from: Item) {
        // copy from template or source
        let templateSource = templateCopy(to, from);

        if (templateSource === source) {
          // primary move

          // delete source
          source.delete();

          // Add ^moved reference from source to target
          let moved = new Reference;
          moved.path = movedPath;
          // absolute reference in context of version
          moved.context = versionPathLength;
          moved.guards = target.path.ids.map(() => undefined);
          // Fake token array
          moved.tokens = target.path.ids.slice(moved.context).map(id => {
            let name = id.toString();
            return new Token('name', 0, name.length, name);
          })
          source.setMeta('^moved', moved);
        } else {
          // move within array entry

          // get copy of source in same entry
          let entrySource = source.workspace.down(
            [...to.path.ids.slice(0, lubLength), ...sourceSuffix]);
          assert(entrySource instanceof Field);

          // copy value from entry source
          to.detachValueIf();
          if (entrySource.value) {
            to.copyValue(entrySource);
          }

          // delete source
          entrySource.delete();

          // overwrite entry source from template source
          templateCopy(entrySource, source);
          let moved = assertDefined(entrySource.get('^moved'));
          moved.eval();
          assert(cast(moved.value, Reference).target === to);
        }
      }

      if (version.formulaType === '::move') {
        // function to replace target
        editor = (target: Item) => {
          templateMove(target, source);
          target.io = source.io;
        }
      } else {
        // new ID allocated in parser follows that of this statement itself
        const newID = new FieldID(version.id.serial + 1);
        // use name of source
        newID.name = source.id.name;
        if (version.formulaType === '::move-append') {
          // append to record

          if (!(target.value instanceof Record)) {
            throw new CompileError(target, 'can only append to record')
          }
          movedPath = movedPath.down(newID);

          editor = (target: Item) => {
            let newField = new Field;
            newField.id = newID;
            newField.io = source.io;
            cast(target.value, Record).add(newField);
            templateMove(newField, source);
          }
        } else {
          // insert before field

          assert(version.formulaType === '::move-insert');
          if (!(target.container instanceof Record)) {
            throw new CompileError(target, 'can only insert into record')
          }
          movedPath = movedPath.up(1).down(newID);

          editor = (target: Item) => {
            let newField = new Field;
            newField.id = newID;
            newField.io = source.io;
            let record = target.container as Record;
            newField.container = record;
            let i = record.fields.indexOf(target as Field);
            assert(i >= 0);
            record.fields.splice(i, 0, newField);
            templateMove(newField, source);
          }
        }
      }

      // delete ^moved annotations after analysis
      cleanup = () => {
        for (let item of head.visit()) {
          item.removeMeta('^moved');
        }
      }

      break;
    }


    case '::make-record':
    case '::make-array': {
      const record = version.formulaType === '::make-record';
      const source = target;

      let newID: RealID;
      if (record) {
        // new ID allocated in parser follows that of this statement itself
        newID = new FieldID(version.id.serial + 1);
        // FIXME: take name from a string argument? Or dup container name?
        newID.name = 'value';
      } else {
        newID = 0;
      }

      // edit function
      // FIXME: doesn't copy from template in array entry. Would need a way to
      // extract current value without source links then overlay onto copy.
      // But note actual create operations don't copy from template either!
      editor = (target: Item) => {
        const movedPath = target.path.down(newID);
        // make copy of target
        let copy = target.copy(target.path, movedPath);
        let item: Item;
        if (record) {
          // convert to Field
          item = new Field;
          item.io = copy.io;
          item.formulaType = copy.formulaType;
        } else {
          // convert to template
          item = new Entry;
          // FIXME what if item is wrong mode for a template?
          assert(target.dataLike && target.formulaType === 'none');
          item.io = 'data';
          item.formulaType = 'none';
        }
        item.id = newID;
        item.conditional = copy.conditional;
        item.editError = copy.editError;

        item.metadata = copy.metadata;
        if (item.metadata) item.metadata.containingItem = item;
        item.value = copy.value;
        if (item.value) item.value.containingItem = item;

        // replace target with wrapped value
        target.detachValueIf();
        if (record) {
          // wrap in record
          let rec = new Record;
          rec.add(item as Field);
          target.setValue(rec);
        } else {
          // wrap in array
          let array = new _Array;
          array.template = item as Entry;
          item.container = array;
          target.setValue(array);
          // Create single entry
          let entry = array.createEntry();
          entry.copyValue(item);
          if (target !== source) {
            // set template value from original source location so make multiple
            // template instances have same value
            item.detachValue();
            item.copyValue((source.value as _Array).template);
          }
        }

        // reformulate target as data
        target.metadata = undefined;
        target.io = 'data';
        target.formulaType = 'none';
        target.conditional = false;
        target.usesPrevious = false;
        target.editError = undefined;
      }
      break;
    }


    case '::convert': {
      // ^source is literal or reference
      const to = version.get('^source');
      literalCheck(to);
      const toType = assertDefined(to.value);
      if (!(toType instanceof Base || toType instanceof Text)) {
        throw new CompileError(to, 'can only convert to base types and text');
      }

      // function to perform edit
      editor = (target: Item) => {
        let fromVal = assertDefined(target.value);
        target.detachValue();
        target.editError = undefined;
        if (toType instanceof Reference) trap();
        if (toType instanceof Nil) {
          // anything can be converted to Nil
          target.setValue(new Nil);
          return;
        }
        if (fromVal instanceof Nil) {
          // Nil gets converted to value of to type
          target.copyValue(to);
          return;
        }

        // convert to text
        if (toType instanceof Text) {
          if (fromVal instanceof Text) {
            // noop
            target.setValue(fromVal);
            return;
          }

          // default to value of toType
          let text = new Text;
          target.setValue(text);
          text.value = toType.value

          if (fromVal instanceof _Number) {
            // number to text
            if (fromVal.isBlank()) {
              // NaN converts to value of toType
              // FIXME - should it be blank value?
            } else {
              // use standard JS numnber to string conversion
              text.value = fromVal.value.toString();
            }
            return;
          }

          if (fromVal instanceof Character) {
            text.value = fromVal.value;
            return;
          }

          // other types convert to toType value
          return;
        }

        // convert to number
        if (toType instanceof _Number) {
          if (fromVal instanceof _Number) {
            // noop
            target.setValue(fromVal);
            return;
          }
          let num = new _Number;
          target.setValue(num);

          if (fromVal instanceof Character) {
            num.value = fromVal.value.charCodeAt(0);
            return;
          }
          if (fromVal instanceof Text) {
            // convert text to number, which may fail
            let text = fromVal.value.trim();
            if (text) {
              num.value = Number(text);
              if (Number.isNaN(num.value)) {
                // conversion error
                target.editError = 'conversion';
              }
            } else {
              // convert empty/whitespace text to NaN
              num.value = Number.NaN;
            }
            return;
          }

          // other types convert to toType value
          num.value = toType.value;
          return;
        }

        // unrecognized conversion type
        trap();
      }

      break;
    }


    default:
      trap();
  }

  // iterate edit into arrays
  iterateEdit(version, targetPath, editor)
  // analyze results of edit
  version.workspace.analyze(version);
  // perform cleanups
  cleanup();
}