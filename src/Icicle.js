import EventEmitter from 'node-event-emitter';
import d3 from 'd3'

export default class Icicle extends EventEmitter {
	constructor(tree, containerSelector, valueFunction) {
		super();

		this._valueCache = new Map();
		this.valueFunction = valueFunction;

		var INNER_NODE_WIDTH = 25;
		var ROOT_NODE_WIDTH = 5;
		var LEAF_WIDTH = 15;
		// the deepest level is guaranteed to only contain leaves
		var depth = tree.root.getDepth();
		var width = INNER_NODE_WIDTH * (depth - 2) + LEAF_WIDTH + ROOT_NODE_WIDTH;
		var height = 500;

		// these scales are only used for inner nodes, so map positions of first and last inner node
		var x = d3.scale.linear()
				.domain([1 / depth, 1 - 1 / depth])
				.range([ROOT_NODE_WIDTH, width - LEAF_WIDTH]);

		var y = d3.scale.linear()
				.range([0, height]);


		var partition = d3.layout.partition()
				.children(d => d.children)
				.value(d => 1);

		var container = d3.select(containerSelector).append('div').attr('class', 'icicle');

		container.append('h3').text(tree.couplingConcept);

		var svg = container
				.append('svg')
				.attr("width", width)
				.attr("height", height);

		var defs = svg.append('defs');
		var gradient = defs.append('linearGradient')
				.attr('id', 'shadow-gradient')
				.attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
		gradient.append('stop').attr('offset', '0%').attr('style', 'stop-color: rgba(0,0,0,0)');
		gradient.append('stop').attr('offset', '80%').attr('style', 'stop-color: rgba(0,0,0,0)');
		gradient.append('stop').attr('offset', '100%').attr('style', 'stop-color: rgba(0,0,0,0.1)');


		var rect = svg.selectAll("rect");
		rect = rect.data(partition(tree.root)).enter();

		function nodeX(d) {
			if (d.isRoot()) {
				return 0;
			}
			return x(d.y);
		} // x and y reversed for horizontal icicle plots
		function nodeY(d) {
			return y(d.x);
		}

		function nodeW(d) {
			if (d.isRoot()) {
				return ROOT_NODE_WIDTH;
			}
			if (d.isLeaf()) {
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

		function createRect() {
			return rect.append("rect")
					.attr("x", nodeX)
					.attr("y", nodeY)
					.attr("width", nodeW)
					.attr("height", nodeH)
					.attr('class', n => 'node--' + n.getKey())
					.classed("root", n => n.isRoot())
					.classed("leaf", n => n.isLeaf())
					.classed("node", true);
		}

		createRect()
				.classed('main-rect', true)
				// color is set by css for leaves and roots
				.attr("fill", n => n.isRoot() || n.isLeaf() ? null : makeColor(this.getValue(n)));
		createRect()
				.classed('shadow-rect', true)
				.attr("fill", 'url(#shadow-gradient)');
		createRect()
				.classed('highlight-rect', true)
				.on("mouseenter", d => this.emit('nodehover', d, d3.event))
				.on("click", d => {
					this.emit('nodeclick', d, d3.event);
					d3.event.stopPropagation();
				})
				.on("mousemove", d => d3.event.stopPropagation())
				.append('title').text(d => d.getLabel());
		rect.append("line")
				.attr("x1", nodeX)
				.attr("y1", nodeY)
				.attr("x2", nodeX)
				.attr("y2", nodeY2)
				.attr("stroke", "white")
				.attr("stroke-width", "1");

		svg.on('mouseleave', () => this.emit('mouseleave', d3.event));
		svg.on('mousedown', () => d3.event.preventDefault());

		this.svg = svg;
	}

	updateSelection(selectionName, selectedKeys) {
		var self = this;
		this.svg.selectAll("rect.main-rect.selected-" + selectionName)
				.classed('selected-' + selectionName, false);
		for (var key of selectedKeys) {
			var node = this.svg.select('rect.main-rect.node--' + key);
			node.classed('selected-' + selectionName, true);
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
