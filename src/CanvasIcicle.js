import EventEmitter from 'node-event-emitter';
import d3 from 'd3';
import $ from 'jquery';
import * as TextUtils from './TextUtils';
import * as Sets from './Sets';

export default class CanvasIcicle extends EventEmitter {
    constructor(tree, containerSelector, valueFunction) {
        super();
        var self = this;

        this._valueCache = new Map();
        this.valueFunction = valueFunction;

        var INNER_NODE_WIDTH = 25;
        var ROOT_NODE_WIDTH = 5;
        var LEAF_WIDTH = 15;
        // the deepest level is guaranteed to only contain leaves
        var depth = tree.root.height;
        var width = INNER_NODE_WIDTH * (depth - 2) + LEAF_WIDTH + ROOT_NODE_WIDTH;
        var height = 500;
        var VERTICAL_LABEL_PADDING = 3;

        // these scales are only used for inner nodes, so map positions of first and last inner node
        var x = d3.scale.linear()
            .domain([1 / depth, 1 - 1 / depth])
            .range([ROOT_NODE_WIDTH, width - LEAF_WIDTH]);

        var y = d3.scale.linear()
            .range([0, height]);

        var partition = d3.layout.partition()
            .children(d => d._children)
            .value(d => d.sortOrder)
            .sort((a,b) => a.sortOrder - b.sortOrder);
        var elements = partition(tree.root);
        this.leafElementByKey = {};
        this.previousSelections = {};
        for (let element of elements) {
            element.selections = {};
            if (element.isLeaf) {
                this.leafElementByKey[element.key] = element;
            }
        }
        this.elements = elements;

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        $(containerSelector).append(canvas);
        $(canvas).css({width: width + 'px', height: '100%'});
        context.imageSmoothingEnabled = false;

        function nodeX(d) {
            if (d.isRoot) {
                return 0;
            }
            return x(d.y);
        } // x and y reversed for horizontal icicle plots
        function nodeY(d) {
            return y(d.x);
        }

        function nodeW(d) {
            if (d.isRoot) {
                return ROOT_NODE_WIDTH;
            }
            if (d.isLeaf) {
                return LEAF_WIDTH;
            }
            return INNER_NODE_WIDTH;
        }

        function nodeH(d) {
            return y(d.dx);
        }

        function nodeY2(d) {
            return nodeY(d) + nodeH(d);
        }

        function nodeColor(d) {
            if (d.isRoot) {
                return '#000080';
            }
            if (d.isLeaf) {
                let colors = [['#FAEB9E', '#f3cd0d'], ['#4040c0', '#1a1a4d']];
                return colors[d.selections.main ? 1 : 0][d.selections.hover ? 1 : 0];
            }
            return makeColor(self.getValue(d));
        }

        this._drawNode = function(d) {
            let x = nodeX(d);
            let y = nodeY(d);
            let w = nodeW(d);
            let h = nodeH(d);
            let y2 = y + h;

            // main color
            context.fillStyle = nodeColor(d);
            context.fillRect(x, Math.round(y), w - 1 /* white spacing */, Math.round(y2) - Math.round(y));

            // labels
            if (!d.isLeaf) {
                context.save();
                context.translate(x + 10, y + VERTICAL_LABEL_PADDING);
                context.rotate(Math.PI / 2);
                context.font = '"OpenSans" 12px';
                context.fillStyle = 'white';
                context.fillText(TextUtils.truncate(d.shortLabel, h - VERTICAL_LABEL_PADDING * 2), 0, 0);
                context.restore();
            }
        };

        this.updateHeight = function() {
            height = canvas.clientHeight;
            y.range([0, height]);
            canvas.height = height;
            canvas.width = width;
            context.clearRect(0, 0, width, height);

            for (let d of elements) {
                this._drawNode(d);
            }

            /*// separating vertical line
            context.strokeStyle = 'white';
            context.translate(0.5, 0.5);
            for (let i = 1; i <= depth; i++) {
                let xx = x(i / depth);
                context.beginPath();
                context.moveTo(xx, 0);
                context.lineTo(xx, height);
                context.stroke();
            }*/
        };

        canvas.addEventListener('mousemove', e => {
            let node = findNodeAtPosition(e.offsetX, e.offsetY);
            if (node) {
                this.emit('nodehover', node, e);
                e.stopPropagation();
            } else {
                this.emit('mouseleave', e);
            }
        });

        canvas.addEventListener('click', e => {
            let node = findNodeAtPosition(e.offsetX, e.offsetY);
            if (node) {
                this.emit('nodeclick', node, e);
                e.stopPropagation();
            }
        });
        canvas.addEventListener('mousedown', e => e.stopPropagation());
        canvas.addEventListener('mouseleave', e => this.emit('mouseleave', e));

        function findNodeAtPosition(posX, posY) {
            let xx = Math.floor(x.invert(posX) * depth);
            let yy = y.invert(posY);
            let node = tree.root;
            for (let i = 0; i < xx; i++) {
                // find the child at the correct vertical position (icicles are rotated, thus x)
                let child = null;
                for (let j = 0; j < node.children.length; j++) {
                    if (node.children[j].x + node.children[j].dx >= yy) {
                        child = node.children[j];
                        break;
                    }
                }
                if (child) {
                    node = child;
                } else {
                    return null;
                }
            }
            return node;
        }

        window.addEventListener('resize', () => this.updateHeight(), true);
        setTimeout(() => this.updateHeight(), 0); // height may only be available at next tick
    }

    updateSelection(selectionName, selectedKeys) {
        let previousSelection = this.previousSelections[selectionName];
        if (!previousSelection) {
            previousSelection = new Set();
        }
        this.previousSelections[selectionName] = selectedKeys;

        let additions = Sets.subtract(selectedKeys, previousSelection);
        let removals = Sets.subtract(previousSelection, selectedKeys);

        for (let key of additions) {
            let element = this.leafElementByKey[key];
            element.selections[selectionName] = true;
            this._drawNode(element);
        }

        for (let key of removals) {
            let element = this.leafElementByKey[key];
            element.selections[selectionName] = false;
            this._drawNode(element);
        }
    }

    getValue(node) {
        if (this._valueCache.has(node)) {
            return this._valueCache.get(node);
        }
        var value = this.valueFunction(node);
        this._valueCache.set(node, value);
        return value;
    }
}

function makeColor(value) {
    var colorScale = d3.scale.linear().range(['#eee', '#000']);
    return colorScale(value);
}
