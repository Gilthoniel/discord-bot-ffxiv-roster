const logger = require('winston');

const values = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

class TreeNodeLeaf {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }

  get(key) {
    if (this.key.startsWith(key)) {
      return this.value;
    }

    throw new Error('key not set');
  }
}

class TreeNode {
  constructor() {
    this.children = {};
  }

  get(key) {
    if (key.length === 0) {
      throw new Error('be more precise');
    }

    const index = key.substr(0, 1);

    if (Object.prototype.hasOwnProperty.call(this.children, index)) {
      const target = this.children[index];

      return target.get(key.substr(1));
    }

    throw new Error('key not found');
  }

  add(key, value) {
    const index = key.substr(0, 1);

    if (Object.prototype.hasOwnProperty.call(this.children, index)) {
      const target = this.children[index];

      if (target instanceof TreeNodeLeaf) {
        logger.info('test');
        const node = new TreeNode();
        // add the previous leaf by shrinking the first letter
        node.add(target.key, target.value);
        // add the new value
        node.add(key.substr(1), value);
        this.children[index] = node;
      } else {
        target.add(key.substr(1), value);
      }
    } else {
      this.children[index] = new TreeNodeLeaf(key.substr(1), value);
    }
  }
}

function buildTree() {
  const root = new TreeNode();

  Object.keys(values).forEach(key => root.add(key, values[key]));

  return root;
}

module.exports = buildTree();
