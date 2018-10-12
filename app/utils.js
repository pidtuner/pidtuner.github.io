// setup helpers
if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}
// async jquery ajax request
$.asyncGet = async function(url, success, error) {
    // must return promise for async/await
    return new Promise((resolve, reject) => {
        // resolve() or reject
        $.ajax({
            url: url,
            success: function (data) {
                success(data);
                resolve();
            }.bind(this),
            error: function (data) {
                console.error(data);
                reject();
            }.bind(this)
        }/*, 'json'*/);
    });
}
// clone array
Array.prototype.clone = function() {
	return this.slice(0);
};
// copy from array
Array.prototype.copyFrom = function(other) {
    this.splice(0, this.length);
    for(var i = 0; i < other.length; i++) {
        var elem = other[i];
        if(typeof elem == 'Array') {
            this.push([]);
            this[i].copyFrom(elem);
        }
        else {
            this.push(elem);
        }
    }
	return this;
};

// compare
Array.prototype.isEqual = function(other) {
  if(this.length != other.length) {
    return false;
  }
  var res = true;
  for(var i = 0; i < other.length; i++) {
        var elem = other[i];
        if(typeof elem == 'Array') {
            res = res && this[i].isEqual(elem);
        }
        else {
            res = res && (this[i] == elem);
        }
        if(!res) {
          break;
        }
    }
    return res;
};
// get instance prototype
if (!Object.getPrototypeOf) {
    Object.getPrototypeOf = function(obj) {
        return obj.__proto__;
    };
}
// add isEmpty
if(!Object.isEmpty) {
  Object.isEmpty = function(obj) {
    Object.keys(obj).length === 0 && obj.constructor === Object
  }
}
// throttle : https://stackoverflow.com/questions/27078285/simple-throttle-in-js
// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time. Normally, the throttled function will run
// as much as it can, without ever going more than once per `wait` duration;
// but if you'd like to disable the execution on the leading edge, pass
// `{leading: false}`. To disable execution on the trailing edge, ditto.
function throttle(func, wait, options) {
  var context, args, result;
  var timeout = null;
  var previous = 0;
  if (!options) options = {};
  var later = function() {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };
  return function() {
    var now = Date.now();
    if (!previous && options.leading === false) previous = now;
    var remaining = wait - (now - previous);
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };
};
// check if browser supports wasm
// https://stackoverflow.com/questions/47879864/how-can-i-check-if-a-browser-supports-webassembly
const wasm = (() => {
    try {
        if (typeof WebAssembly === "object"
            && typeof WebAssembly.instantiate === "function") {
            const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
            if (module instanceof WebAssembly.Module)
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        }
    } catch (e) {
    }
    return false;
})();
// Arma helpers
var cxmatFromRealArray = (arr) => {
  var ret = Arma.CxMat.zeros(arr.length, 1);
  for(var k = 0; k < arr.length; k++) {
    ret.set_at(k, 0, new Arma.cx_double(arr[k], 0));  
  }
  return ret;
};