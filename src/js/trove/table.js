({
  requires: [
    { "import-type": "builtin", name: "valueskeleton" },
    { "import-type": "builtin", name: "equality" },
    { "import-type": "builtin", name: "ffi" }
  ],
  nativeRequires: [
    "pyret-base/js/type-util"
  ],
  provides: {},
  theModule: function(runtime, namespace, uri, VSlib, EQlib, ffi, t) {
    var get = runtime.getField;

    var VS = get(VSlib, "values");
    var EQ = get(EQlib, "values");
    
    var brandTable = runtime.namedBrander("table", ["table: table brander"]);
    var annTable   = runtime.makeBranderAnn(brandTable, "Table");

    function applyBrand(brand, val) {
      return get(brand, "brand").app(val);
    }
    
    function hasBrand(brand, val) {
      return get(brand, "test").app(val);
    }
    
    function isTable(val) {
      return hasBrand(brandTable,  val);
    }

    function openTable(info) {
      runtime.checkTuple(info);
      if (info.vals.length != 2) {
        runtime.ffi.throwMessageException("Expected to find {header; contents} pair, "
                                          + "but found a tuple of length "
                                          + info.vals.length);
      }
      var headers = info.vals[0];
      var contents = info.vals[1];
      runtime.checkArray(headers);
      runtime.checkArray(contents);
      var names = [];
      var sanitizers = [];
      for(var i = 0; i < headers.length; ++i) {
        runtime.checkTuple(headers[i]);
        if (headers[i].vals.length !== 2) {
          runtime.ffi.throwMessageException("Expected to find {name; sanitizer} pairs "
                                            + "in header data, but found a tuple of "
                                            + "length " + headers[i].vals.length);
        }
        var header = headers[i].vals;
        runtime.checkString(header[0]);
        runtime.checkFunction(header[1]);
        names.push(header[0]);
        sanitizers.push(header[1]);
      }
      return runtime.safeCall(function() {
        return runtime.eachLoop(runtime.makeFunction(function(i) {
          runtime.checkArray(contents[i]);
          if (contents[i].length !== headers.length) {
            if (i === 0) {
              runtime.ffi.throwMessageException("Contents must match header size");
            } else {
              runtime.ffi.throwMessageException("Contents must be rectangular");
            }
          }
          // This loop is stack safe, since it's just a brand-checker
          for (var j = 0; j < contents[i].length; ++j) {
            runtime.checkCellContent(contents[i][j]);
          }
          return runtime.safeCall(function() {
            return runtime.raw_array_mapi(runtime.makeFunction(function(v, j) {
              return sanitizers[j].app(contents[i][j], names[j], runtime.makeNumber(i));
            }), contents[i]);
          }, function(new_contents_i) {
            contents[i] = new_contents_i;
            return runtime.nothing;
          }, "openTable:assign-rows");
        }), 0, contents.length);
      }, function(_) {
        return makeTable(names, contents);
      }, "openTable");
    }

    function makeTable(headers, rows) {
      ffi.checkArity(2, arguments, "makeTable", false);
      
      var headerIndex = {};
      
      for (var i = 0; i < headers.length; i++) {
        headerIndex["column:" + headers[i]] = i;
      }
      
      function getColumn(column_name) {
        /* TODO: Raise error if table lacks column */
        var column_index;
        Object.keys(headers).forEach(function(i) {
          if(headers[i] == column_name) { column_index = i; }
        });
        return rows.map(function(row){return row[column_index];});
      }
      
      function hasColumn(column_name) {
        return headerIndex.hasOwnProperty("column:" + column_name);
      }
      
      function getRowAsRecord(row_index) {
        /* TODO: Raise error if no row at index */
        var obj = {};
        var row = rows[row_index];
        for(var i = 0; i < headers.length; i++) {
          obj[headers[i]] = row[i];
        }
        return obj;
      }

      function getRowContentAsRecordFromHeaders(headers, raw_row) {
        /* TODO: Raise error if no row at index */
        var obj = {};
        for(var i = 0; i < headers.length; i++) {
          obj[headers[i]] = raw_row[i];
        }
        return obj;
      }

      function getRowContentAsRecord(raw_row) {
        return getRowContentAsRecordFromHeaders(headers, raw_row);
      }

      function getRowContentAsGetter(headers, raw_row) {
        var obj = getRowContentAsRecordFromHeaders(headers, raw_row);
        obj["get-value"] = runtime.makeFunction(function(key) {
            if(obj.hasOwnProperty(key)) {
              return obj[key];
            }
            else {
              runtime.ffi.throwMessageException("Not found: " + key);
            }
          });
        return runtime.makeObject(obj);
      }

      function multiOrder(sourceArr, colComps, destArr) {
        // sourceArr is a raw JS array of table rows
        // colComps is an array of 2-element arrays, [true iff ascending, colName]
        // destArr is the final array in which to place the sorted rows
        // returns destArr, and mutates destArr
        var colIdxs = [];
        var comps = [];
        var LESS = "less";
        var EQ = "equal";
        var MORE = "more";
        for (var i = 0; i < colComps.length; i++) {
          comps[i] = (colComps[i][0] ? runtime.lessthan : runtime.greaterthan);
          colIdxs[i] = headerIndex["column:" + colComps[i][1]];
          for (var dupIdx = i + 1; dupIdx < colComps.length; dupIdx++) {
            if (colComps[i][1] === colComps[dupIdx][1]) {
              runtime.ffi.throwMessageException(
                "Attempted to sort on the same column multiple times: "
                  + "'" + colComps[i][1] + "' is used as sort-key " + i
                  + ", and also as sort-key " + dupIdx);
            }
          }
        }
        function helper(sourceArr) {
          var lessers = [];
          var equals = [];
          var greaters = [];
          var pivot = sourceArr[0];
          equals.push(pivot);
          return runtime.safeCall(function() {
            return runtime.eachLoop(runtime.makeFunction(function(rowIdx) {
              return runtime.safeCall(function() {
                return runtime.raw_array_fold(runtime.makeFunction(function(order, comp, colIdx) {
                  if (order !== EQ) return order;
                  else {
                    return runtime.safeCall(function() {
                      return comp(sourceArr[rowIdx][colIdxs[colIdx]], pivot[colIdxs[colIdx]]);
                    }, function(isLess) {
                      if (isLess) return LESS;
                      else return runtime.safeCall(function() {
                        return runtime.equal_always(sourceArr[rowIdx][colIdxs[colIdx]], pivot[colIdxs[colIdx]]);
                      }, function(isEqual) {
                        return (isEqual ? EQ : MORE);
                      }, "multiOrder-isGreater");
                    }, "multiOrder-isLess");
                  }
                }), EQ, comps, 0);
              }, function(order) {
                if (order === LESS) { lessers.push(sourceArr[rowIdx]); }
                else if (order === EQ) { equals.push(sourceArr[rowIdx]); }
                else { greaters.push(sourceArr[rowIdx]); }
                return runtime.nothing;
              }, "multiOrder-temparrs");
            }), 1, sourceArr.length); // start from 1, since index 0 is the pivot
          }, function(_) {
            return runtime.safeCall(function() {
              if (lessers.length === 0) { return destArr; }
              else { return helper(lessers); }
            }, function(_) {
              for (var i = 0; i < equals.length; i++)
                destArr.push(equals[i].slice()); // need to copy here
              if (greaters.length === 0) { return destArr; }
              else { return helper(greaters); }
            }, "multiOrder-finalMoves");
          });
        }
        return helper(sourceArr);
      }

      function order(direction, colname) {
        var asList = runtime.ffi.makeList(rows);
        var index = headerIndex["column:" + colname];
        var comparator = direction ? runtime.lessthan : runtime.greaterthan;
        var compare = runtime.makeFunction(function(l, r) {
          return comparator(l[index], r[index]);
        });
        var equal = runtime.makeFunction(function(l, r) {
          return runtime.equal_always(l[index], r[index]);
        });
        return runtime.safeCall(function() {
          return runtime.getField(asList, "sort-by").app(compare, equal);
        }, function(sortedList) {
          return makeTable(headers, runtime.ffi.toArray(sortedList));
        }, "order-sort-by");

      }

      return applyBrand(brandTable, runtime.makeObject({

        '_header-raw-array': headers,
        '_rows-raw-array': rows,

        'order-increasing': runtime.makeMethod1(function(_, colname) {
          return order(true, colname);
        }),
        'order-decreasing': runtime.makeMethod1(function(_, colname) {
          return order(false, colname);
        }),

        'multi-order': runtime.makeMethod1(function(_, colComps) {
          // colComps is an array of 2-element arrays, [true iff ascending, colName]
          return runtime.safeCall(function() {
            return multiOrder(rows, colComps, []);
          }, function(destArr) {
            return makeTable(headers, destArr);
          }, "multi-order");
        }),

        'stack': runtime.makeMethod1(function(_, otherTable) {
          var otherHeaders = runtime.getField(otherTable, "_header-raw-array");
          if(otherHeaders.length !== headers.length) {
            return ffi.throwMessageException("Tables have different column sizes in stack: " + headers.length + " " + otherHeaders.length);
          }
          var headersSorted = headers.slice(0, headers.length).sort();
          var otherHeadersSorted = otherHeaders.slice(0, headers.length).sort();
          headersSorted.forEach(function(h, i) {
            if(h !== otherHeadersSorted[i]) {
              return ffi.throwMessageException("The table to be stacked is missing column " + h);
            }
          });

          var newRows = runtime.getField(otherTable, "_rows-raw-array");
          newRows = newRows.map(function(row) {
            var rowAsRec = getRowContentAsRecordFromHeaders(otherHeaders, row);
            console.log(headers);
            var newRow = headers.map(function(h) {
              return rowAsRec[h];
            });
            return newRow;
          });
          return makeTable(headers, rows.concat(newRows));
        }),

        'reduce': runtime.makeMethod2(function(_, colname, reducer) {
          if(rows.length === 0) { ffi.throwMessageException("Reducing an empty table (column names were " + headers.join(", ") + ")"); }
          var column = getColumn(colname);
          return runtime.safeCall(function() {
            return runtime.safeCall(function() {
              return runtime.getField(reducer, "one").app(column[0]);
            }, function(one) {
              if(rows.length === 1) {
                return one;
              }
              else {
                var reduce = runtime.getField(reducer, "reduce");
                var reducerWrapped = runtime.makeFunction(function(acc, val, ix) {
                  return reduce.app(runtime.getTuple(acc, 0, ["tables"]), val);
                });
                return runtime.raw_array_fold(reducerWrapped, one, column.slice(1), 1);
              }
            }, "reduce-one");
          }, function(answerTuple) {
            return runtime.getTuple(answerTuple, 1, ["tables"]); 
          }, "reduce-rest");
        }),

        'empty': runtime.makeMethod0(function(_) {
          return makeTable(headers, []);
        }),

        'drop': runtime.makeMethod1(function(_, colname) {
          var newHeaders = headers.filter(function(h) { return h !== colname; })
          var dropFunc = function(rawRow) {
          };
          var newRows = rows.map(function(rawRow) {
            return rawRow.filter(function(h, i) {
              return i !== headerIndex['column:' + colname];
            });
          });
          return makeTable(newHeaders, newRows);
        }),


        'add': runtime.makeMethod1(function(_, colname, func) {
          var wrappedFunc = function(rawRow) {
            return runtime.safeCall(function() {
              return func.app(getRowContentAsGetter(headers, rawRow));
            },
            function(newVal) {
              return rawRow.concat([newVal]);
            }, "table-add-cell");
          };

          return runtime.safeCall(function() {
            return runtime.raw_array_map(runtime.makeFunction(wrappedFunc, "func"), rows);
          }, function(newRows) {
            return makeTable(headers.concat([colname]), newRows);
          }, "table-add-column");
        }),

        'filter-by': runtime.makeMethod2(function(_, colname, pred) {
          var wrappedPred = function(rawRow) {
            return pred.app(getRowContentAsRecord(rawRow)[colname]);
          }
          return runtime.safeCall(function() {
            return runtime.raw_array_filter(runtime.makeFunction(wrappedPred, "pred"), rows);
          }, function(filteredRows) {
            return makeTable(headers, filteredRows);
          }, "table-filter-by");
        }),


        'filter': runtime.makeMethod1(function(_, pred) {
          var wrappedPred = function(rawRow) {
            return pred.app(getRowContentAsGetter(headers, rawRow));
          }
          return runtime.safeCall(function() {
            return runtime.raw_array_filter(runtime.makeFunction(wrappedPred, "pred"), rows);
          }, function(filteredRows) {
            return makeTable(headers, filteredRows);
          }, "table-filter");
        }),

        'get-row': runtime.makeMethod1(function(_, row_index) {
          ffi.checkArity(2, arguments, "get-row", true);
          runtime.checkArrayIndex("get-row", rows, row_index);
          return getRowContentAsGetter(headers, rows[row_index]);
        }),
        
        'length': runtime.makeMethod0(function(_) {
          ffi.checkArity(1, arguments, "length", true);
          return runtime.makeNumber(rows.length);
        }),
        
        'get-column': runtime.makeMethod1(function(_, col_name) {
          ffi.checkArity(2, arguments, "get-column", true);
          if(!hasColumn(col_name)) {
            ffi.throwMessageException("The table does not have a column named `"+col_name+"`.");
          }
          return runtime.ffi.makeList(getColumn(col_name));
        }),
        
        '_column-index': runtime.makeMethod3(function(_, operation_loc, table_loc, col_name, col_loc) {
          ffi.checkArity(5, arguments, "_column-index", true);
          var col_index = headerIndex['column:'+col_name];
          if(col_index === undefined) {
            ffi.throwColumnNotFound(operation_loc, col_name, col_loc,
              runtime.ffi.makeList(Object.keys(headerIndex).map(function(k) { return k.slice(7); })));
          }
          return col_index;
        }),
        
        '_no-column': runtime.makeMethod3(function(_, operation_loc, table_loc, col_name, col_loc) {
          ffi.checkArity(5, arguments, "_no-column", true);
          var col_index = headerIndex['column:'+col_name];
          if(col_index != undefined)
            ffi.throwDuplicateColumn(operation_loc, col_name, col_loc);
          return col_index;
        }),
        
        '_equals': runtime.makeMethod2(function(self, other, equals) {
          ffi.checkArity(3, arguments, "_equals", true);
          // is the other a table
          // same number of columns?
          // same number of rows?
          // columns have same names?
          // each row has the same elements
          var eq  = function() { return ffi.equal; };
          var neq = function() { return ffi.notEqual.app('', self, other); };
          if (!hasBrand(brandTable, other)) {
            return neq();
          }
          var otherHeaders = get(other, "_header-raw-array");
          var otherRows = get(other, "_rows-raw-array");
          if (headers.length !== otherHeaders.length
              || rows.length !== otherRows.length) {
            return neq();
          }
          for (var i = 0; i < headers.length; ++i) {
            if (headers[i] != otherHeaders[i]) {
              return neq();
            }
          }
          return runtime.raw_array_fold(runtime.makeFunction(function(ans, selfRow, i) {
            if (ffi.isNotEqual(ans)) { return ans; }
            var otherRow = otherRows[i];
            return runtime.raw_array_fold(runtime.makeFunction(function(ans, selfRowJ, j) {
              if (ffi.isNotEqual(ans)) { return ans; }
              return runtime.safeCall(function() {
                return equals.app(selfRowJ, otherRow[j]);
              }, function(eqAns) {
                return get(EQ, "equal-and").app(ans, eqAns);
              }, "equals:combine-cells");
            }), ans, selfRow, 0);
          }), eq(), rows, 0);
        }),
        
        '_output': runtime.makeMethod0(function(_) {
          ffi.checkArity(1, arguments, "_output", true);
          var vsValue = get(VS, "vs-value").app;
          var vsString = get(VS, "vs-str").app;
          return get(VS, "vs-table").app(
            headers.map(function(hdr){return vsString(hdr);}),
            rows.map(function(row){return row.map(
              function(elm){return vsValue(elm);});}));
        })
      }));
    }
    
    return runtime.makeJSModuleReturn({
      TableAnn : annTable,
      makeTable: makeTable,
      openTable: openTable,
      isTable: isTable },
      {});
  }
})
