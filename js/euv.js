// ------------------------------------------------------------
// Euv
// ------------------------------------------------------------

function Euv(options) {
  this._init(options);
}

// ------------------------------------------------------------
// DIRECTIVES
// ------------------------------------------------------------

Euv.prototype.DIRECTIVES = Object.freeze({
  text: {
    update: (element, { value }) => {
      element.textContent = value;
    },
  },
  html: {
    update: (element, { value }) => {
      element.innerHTML = value;
    },
  },
  // Both effect v-if and v-else
  if: {
    update: (element, { value }) => {
      const parent = element.parentElement;
      const nextSibling = element.nextElementSibling;
      if (!value) {
        parent.replaceChild(document.createComment(""), element);
      } else if (nextSibling && nextSibling.hasAttribute("v-else")) {
        parent.replaceChild(document.createComment(""), nextSibling);
      }
    },
  },
  else: {
    update: () => {
      // Do nothing
    },
  },
});

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

Euv.prototype._init = function (options) {
  this.options = options;
  this.$el = document.querySelector(options.el);

  this._backupDom();

  this._proxyData(options.data);
  this._addMethods(options.methods);

  this._render();
};

// ------------------------------------------------------------
// Instance
// ------------------------------------------------------------

Euv.prototype._backupDom = function () {
  this.$backupDom = this.$el.cloneNode(true);
};

Euv.prototype._proxyData = function (data) {
  let dataResult;
  if (typeof data === "object") {
    dataResult = data;
  } else if (typeof data === "function") {
    dataResult = data();
  } else {
    throw new Error("data must be an object or a function");
  }

  this.$data = new Proxy(dataResult, {
    get: (target, key) => {
      return target[key];
    },
    set: (target, key, value) => {
      target[key] = value;
      this._render();
      return true;
    },
  });

  for (const key in this.$data) {
    Object.defineProperty(this, key, {
      get() {
        return this.$data[key];
      },
      set(value) {
        this.$data[key] = value;
        return true;
      },
    });
  }
};

Euv.prototype._addMethods = function (methods) {
  for (const key in methods) {
    this[key] = methods[key];
  }
};

// ------------------------------------------------------------
// DOM Manipulation
// ------------------------------------------------------------

Euv.prototype._walkDom = function (node, callback) {
  // TODO: Only re-render the changed node
  const firstChild = node.firstChild;
  if (node && node.nodeType === 1) {
    callback(node);
  }
  node = firstChild;
  while (node) {
    const nextSibling = node.nextSibling;
    this._walkDom(node, callback);
    node = nextSibling;
  }
};

Euv.prototype._callEval = function (expression) {
  return eval("with (this) { " + expression + " }");
};

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

Euv.prototype._renderText = function (element) {
  if (
    element.textContent.startsWith("{{") &&
    element.textContent.endsWith("}}")
  ) {
    element.textContent = this._callEval(element.textContent.slice(2, -2));
  }
};

Euv.prototype._executeDirectives = function (element) {
  Array.from(element.attributes)
    .filter((attribute) => attribute.name.startsWith("v-"))
    .forEach((attribute) => {
      const directive = attribute.name.slice(2);
      if (!this.DIRECTIVES[directive]) {
        throw new Error(`Directive ${directive} not found`);
      }

      this.DIRECTIVES[directive].update(element, {
        name: attribute.name,
        value: this._callEval(attribute.value),
        expression: attribute.value,
      });
      element.removeAttribute(attribute.name);
    });
};

Euv.prototype._registerEvents = function (element) {
  Array.from(element.attributes)
    .filter((attribute) => attribute.name.startsWith("@"))
    .forEach((attribute) => {
      const event = attribute.name.slice(1);
      element.addEventListener(
        event,
        this._callEval(attribute.value).bind(this)
      );
      element.removeAttribute(attribute.name);
    });
};

Euv.prototype._render = function () {
  const newElement = this.$backupDom.cloneNode(true);
  document.body.replaceChild(newElement, this.$el);
  this.$el = newElement;
  this._walkDom(this.$el, (element) => {
    console.log("⏳ ~ euv.js ~ this._walkDom ~ element:", element);
    this._renderText(element);
    this._executeDirectives(element);
    this._registerEvents(element);
  });
};
