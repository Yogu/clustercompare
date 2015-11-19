// note: use the new CanvasIcicle implementation which provides better performance
import Icicle from './CanvasIcicle';
import * as ColorGenerator from './ColorGenerator';

/**
 * An icicle plot visualization that is bound bidirectionally to the model
 */
export default class BoundIcicle extends Icicle {
	constructor(tree, containerSelector, viewModel) {
		super(tree, containerSelector, BoundIcicle._getValueFunction(tree, viewModel));
		this._viewModel = viewModel;
		this._model = viewModel.model;
		this._initEvents();
	}

	_initEvents() {
		this.on('nodehover', node => this._viewModel.hoverSelection.select(node.isRoot ? null : node));
		this.on('mouseleave', () => this._viewModel.hoverSelection.select(null));
		this.on('nodeclick', (node, e) => {
			if (e.ctrlKey) {
				if (node.isRoot) {
					return;
				}
				if (this._viewModel.mainSelection.isSelected(node)) {
					this._viewModel.mainSelection.removeFromSelection(node);
				} else {
					this._viewModel.mainSelection.addToSelection(node);
				}
			} else {
				this._viewModel.mainSelection.select(node.isRoot ? null : node);
			}
		});

		this._viewModel.mainSelection.on('change', () =>
			this.updateSelection('main', this._viewModel.mainSelection.selectedKeys));
		this._viewModel.hoverSelection.on('change', () =>
			this.updateSelection('hover', this._viewModel.hoverSelection.selectedKeys));
	}

	static _getValueFunction(tree, viewModel) {
		var model = viewModel.model;
		if (tree.couplingConcept == 'packages') {
			if (viewModel.selectedClusterings.items.length == 0) {
				return node => 0;
			}

			return node => {
				let maxSimilarity = null;
				let value;
				for (let tree of viewModel.selectedClusterings.items.map(key => model.getTree(key))) {
					let similarity = node.getMaxSimilarity(tree.root);
					if (maxSimilarity == null || similarity > maxSimilarity) {
						maxSimilarity = similarity;
						value = {
							intensity: similarity,
							sideColor: ColorGenerator.colorForClustering(tree.root.clustering)
						};
					}
				}
				return value;
			}
		}

		var packagesTree = model.packagesTree;
		return node => node.getMaxSimilarity(packagesTree.root);
	}
}
